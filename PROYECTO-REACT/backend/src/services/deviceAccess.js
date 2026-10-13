const crypto = require('node:crypto');
const db = require('../config/database');
const pending = new Map();
let ready;
function init() {
    return ready ||= db.execute(`CREATE TABLE IF NOT EXISTS socio_dispositivos (
        usuario_id INT PRIMARY KEY, credential_id VARCHAR(1400) CHARACTER SET ascii NOT NULL UNIQUE,
        public_key TEXT NOT NULL, counter BIGINT NOT NULL DEFAULT 0,
        actualizado TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`).catch(e => { ready = null; throw e; });
}
function issue(data) {
    for (const [id, item] of pending) if (item.expires < Date.now()) pending.delete(id);
    const id = crypto.randomUUID();
    pending.set(id, { ...data, expires: Date.now() + 300000 });
    return id;
}
function take(id, owner, kind) {
    const value = pending.get(id);
    pending.delete(id);
    if (!value || value.expires < Date.now() || value.owner !== owner || value.kind !== kind)
        throw new Error('La verificación expiró. Inténtalo nuevamente.');
    return value;
}
function getLanOrigins() {
    const origins = [];
    try {
        const os = require('node:os');
        const nets = os.networkInterfaces();
        for (const name of Object.keys(nets)) {
            for (const net of nets[name]) {
                if (net.family === 'IPv4' && !net.internal) {
                    origins.push(`http://${net.address}:8081`);
                    origins.push(`http://${net.address}:8082`);
                }
            }
        }
    } catch (_) {}
    return origins;
}

function context(req) {
    const defaultOrigins = ['http://localhost:8081', 'http://localhost:8082', 'http://127.0.0.1:8081', 'http://127.0.0.1:8082'];
    const envOrigins = (process.env.WEBAUTHN_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean);
    const lanOrigins = getLanOrigins();
    const allowed = [...defaultOrigins, ...envOrigins, ...lanOrigins];
    const origin = req?.headers?.origin;
    if (!origin) throw new Error('Este origen no está habilitado para verificar el dispositivo.');

    let isAllowed = allowed.includes(origin);
    if (!isAllowed) {
        const reqHost = req?.headers?.['x-forwarded-host'] || req?.headers?.host;
        try {
            const u = new URL(origin);
            if (u.protocol === 'https:' && reqHost && (u.host === reqHost || reqHost.split(':')[0] === u.hostname)) {
                isAllowed = true;
            } else if ((u.hostname === 'localhost' || u.hostname === '127.0.0.1') && u.protocol === 'http:') {
                isAllowed = true;
            }
        } catch (_) {}
    }

    if (!isAllowed) throw new Error('Este origen no está habilitado para verificar el dispositivo.');
    const url = new URL(origin);
    const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1' || lanOrigins.includes(origin);
    if (url.protocol !== 'https:' && !isLocal && !envOrigins.includes(origin)) throw new Error('El dispositivo requiere una conexión HTTPS.');
    return { origin, rpID: url.hostname };
}
function verify(assertion, entry, publicKey, credentialId, previousCounter = 0) {
    if (!assertion || assertion.id !== credentialId || assertion.type !== 'public-key') throw new Error('Dispositivo no reconocido.');
    const clientBytes = Buffer.from(assertion.response.clientDataJSON, 'base64url');
    const client = JSON.parse(clientBytes.toString());
    if (client.type !== 'webauthn.get' || client.challenge !== entry.challenge || client.origin !== entry.origin || client.crossOrigin === true)
        throw new Error('La confirmación no corresponde a esta solicitud.');
    const auth = Buffer.from(assertion.response.authenticatorData, 'base64url');
    const rpHash = crypto.createHash('sha256').update(entry.rpID).digest();
    if (auth.length < 37 || !crypto.timingSafeEqual(auth.subarray(0, 32), rpHash) || (auth[32] & 5) !== 5)
        throw new Error('El dispositivo no confirmó la identidad.');
    const key = crypto.createPublicKey({ key: Buffer.from(publicKey, 'base64url'), format: 'der', type: 'spki' });
    if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails.namedCurve !== 'prime256v1') throw new Error('Clave de dispositivo no compatible.');
    const signed = Buffer.concat([auth, crypto.createHash('sha256').update(clientBytes).digest()]);
    if (!crypto.verify('sha256', signed, key, Buffer.from(assertion.response.signature, 'base64url'))) throw new Error('Firma de dispositivo inválida.');
    const counter = auth.readUInt32BE(33);
    if ((counter || previousCounter) && counter <= previousCounter) throw new Error('Confirmación de dispositivo reutilizada.');
    return counter;
}
async function save(userId, credential) {
    await init();
    await db.execute(`INSERT INTO socio_dispositivos (usuario_id, credential_id, public_key, counter) VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE credential_id=VALUES(credential_id), public_key=VALUES(public_key), counter=VALUES(counter)`,
    [userId, credential.credentialId, credential.publicKey, credential.counter]);
}
function claim(ticket, owner, dni) {
    if (!ticket) return null;
    const value = take(ticket, owner, 'enrolled');
    if (value.dni !== dni) throw new Error('El DNI cambió. Registra el dispositivo nuevamente.');
    return value;
}

const remoteSessions = new Map();
function createRemoteSession(owner, { action, dni, socioNombre }) {
    for (const [id, s] of remoteSessions) {
        if (s.expires < Date.now()) remoteSessions.delete(id);
    }
    const id = crypto.randomUUID();
    const session = {
        id,
        owner: String(owner),
        action, // 'register' | 'authenticate'
        dni: dni ? String(dni) : null,
        socioNombre: socioNombre || null,
        status: 'pending',
        result: null,
        error: null,
        created: Date.now(),
        expires: Date.now() + 180000,
    };
    remoteSessions.set(id, session);
    return session;
}
function getRemoteSession(id, owner) {
    const s = remoteSessions.get(id);
    if (!s || s.expires < Date.now()) return null;
    if (owner && s.owner !== String(owner)) return null;
    return s;
}
function getActiveRemoteSession(owner) {
    for (const [_, s] of remoteSessions) {
        if (s.owner === String(owner) && s.status === 'pending' && s.expires > Date.now()) {
            return s;
        }
    }
    return null;
}
function completeRemoteSession(id, result) {
    const s = remoteSessions.get(id);
    if (!s || s.expires < Date.now()) throw new Error('La sesión de escaneo móvil expiró.');
    s.status = 'completed';
    s.result = result;
    return s;
}
function cancelRemoteSession(id) {
    const s = remoteSessions.get(id);
    if (s) {
        s.status = 'cancelled';
    }
    return s;
}

module.exports = {
    init,
    issue,
    take,
    context,
    verify,
    save,
    claim,
    createRemoteSession,
    getRemoteSession,
    getActiveRemoteSession,
    completeRemoteSession,
    cancelRemoteSession,
};
