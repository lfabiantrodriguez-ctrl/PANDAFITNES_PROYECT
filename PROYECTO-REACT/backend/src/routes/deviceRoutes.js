const router = require('express').Router();
const crypto = require('node:crypto');
const db = require('../config/database');
const access = require('../services/deviceAccess');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
router.use(authenticateToken, requireRole('admin'));
const wrap = fn => async (req, res) => { try { await fn(req, res); } catch (e) { res.status(400).json({ message: e.message }); } };
const owner = req => String(req.auth.id);
router.get('/:id/status', wrap(async (req, res) => {
    await access.init();
    const [rows] = await db.execute('SELECT usuario_id FROM socio_dispositivos WHERE usuario_id=?', [Number(req.params.id)]);
    res.json({ registered: Boolean(rows[0]) });
}));
router.post('/register/options', wrap(async (req, res) => {
    const dni = String(req.body.dni || '').trim();
    if (!/^\d{8}$/.test(dni)) throw new Error('Ingresa primero el DNI de 8 dígitos.');
    const ctx = access.context(req);
    const challenge = crypto.randomBytes(32).toString('base64url');
    const ceremony = access.issue({ kind: 'register', owner: owner(req), dni, challenge, ...ctx });
    res.json({ ceremony, challenge, rpID: ctx.rpID, userID: crypto.randomBytes(32).toString('base64url'), dni });
}));
router.post('/register/proof', wrap(async (req, res) => {
    const entry = access.take(req.body.ceremony, owner(req), 'register');
    const challenge = crypto.randomBytes(32).toString('base64url');
    // A fresh signed assertion proves possession and user verification for the new key.
    const ceremony = access.issue({ ...entry, kind: 'proof', challenge,
        credentialId: req.body.credentialId, publicKey: req.body.publicKey });
    res.json({ ceremony, challenge, rpID: entry.rpID, credentialId: req.body.credentialId });
}));
router.post('/register/verify', wrap(async (req, res) => {
    const entry = access.take(req.body.ceremony, owner(req), 'proof');
    entry.counter = access.verify(req.body.assertion, entry, entry.publicKey, entry.credentialId);
    const ticket = access.issue({ ...entry, kind: 'enrolled' });
    res.json({ ticket });
}));
router.post('/authenticate/options', wrap(async (req, res) => {
    await access.init();
    const dni = String(req.body.dni || '').trim();
    let credentialId = null;
    let credentialIds = [];
    let entry = null;

    if (dni) {
        const [rows] = await db.execute(`SELECT d.*, u.dni FROM socio_dispositivos d JOIN usuarios u ON u.id=d.usuario_id WHERE u.dni=? AND u.activo=1`, [dni]);
        if (!rows[0]) throw new Error('Este socio aún no tiene una huella registrada.');
        entry = rows[0];
        credentialId = entry.credential_id;
        credentialIds = [credentialId];
    } else {
        const [rows] = await db.execute(`SELECT d.credential_id FROM socio_dispositivos d JOIN usuarios u ON u.id=d.usuario_id WHERE u.activo=1`);
        if (!rows.length) throw new Error('Aún no hay socios con huella registrada en el sistema. Registra la huella de un socio primero.');
        credentialIds = rows.map(r => r.credential_id);
    }

    const challenge = crypto.randomBytes(32).toString('base64url');
    const ctx = access.context(req);
    const ceremonyData = { kind: 'authenticate', owner: owner(req), challenge, ...ctx, dni: dni || null };
    if (entry) {
        ceremonyData.usuario_id = entry.usuario_id;
        ceremonyData.credential_id = entry.credential_id;
        ceremonyData.public_key = entry.public_key;
        ceremonyData.counter = entry.counter;
    }
    const ceremony = access.issue(ceremonyData);
    res.json({ ceremony, challenge, rpID: ctx.rpID, credentialId, credentialIds });
}));
router.post('/authenticate/verify', wrap(async (req, res) => {
    const entry = access.take(req.body.ceremony, owner(req), 'authenticate');
    const assertion = req.body.assertion;
    if (!assertion || !assertion.id) throw new Error('No se recibió la lectura biométrica.');

    const [rows] = await db.execute(
        `SELECT d.*, u.dni, u.nombre, u.apellido, u.activo 
         FROM socio_dispositivos d 
         JOIN usuarios u ON u.id=d.usuario_id 
         WHERE d.credential_id=? AND u.activo=1`,
        [assertion.id]
    );
    if (!rows[0]) throw new Error('Huella no reconocida en el sistema.');
    const matched = rows[0];

    if (entry.dni && entry.dni !== matched.dni) {
        throw new Error('La huella detectada no corresponde al DNI indicado.');
    }

    const counter = access.verify(assertion, entry, matched.public_key, matched.credential_id, Number(matched.counter));
    const [result] = await db.execute(
        'UPDATE socio_dispositivos SET counter=? WHERE usuario_id=? AND credential_id=? AND counter=?',
        [counter, matched.usuario_id, matched.credential_id, matched.counter]
    );
    if (!result.affectedRows) throw new Error('El registro de la huella cambió. Inténtalo de nuevo.');
    const proof = access.issue({ kind: 'attendance', owner: owner(req), dni: matched.dni });
    res.json({
        proof,
        dni: matched.dni,
        user: {
            id: matched.usuario_id,
            dni: matched.dni,
            nombre: matched.nombre,
            apellido: matched.apellido,
        },
    });
}));
module.exports = router;
