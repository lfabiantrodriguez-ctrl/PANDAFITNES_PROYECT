const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const access = require('../src/services/deviceAccess');
const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const key = publicKey.export({ format: 'der', type: 'spki' }).toString('base64url');
const entry = { origin: 'http://localhost:8081', rpID: 'localhost', challenge: 'random-challenge' };
function assertion({ flags = 5, count = 1, origin = entry.origin, challenge = entry.challenge, rpID = entry.rpID, type = 'webauthn.get' } = {}) {
    const client = Buffer.from(JSON.stringify({ type, origin, challenge, crossOrigin: false }));
    const auth = Buffer.alloc(37);
    crypto.createHash('sha256').update(rpID).digest().copy(auth);
    auth[32] = flags; auth.writeUInt32BE(count, 33);
    const data = Buffer.concat([auth, crypto.createHash('sha256').update(client).digest()]);
    return { id: 'credential', type: 'public-key', response: {
        clientDataJSON: client.toString('base64url'), authenticatorData: auth.toString('base64url'),
        signature: crypto.sign('sha256', data, privateKey).toString('base64url'),
    } };
}
test('accepts a signed confirmation with user verification', () => {
    assert.equal(access.verify(assertion(), entry, key, 'credential'), 1);
});
test('rejects changed origin, challenge, RP, type, missing verification and replayed counter', () => {
    for (const change of [{origin:'https://attacker.example'}, {challenge:'other'}, {rpID:'other'}, {type:'webauthn.create'}, {flags:1}, {flags:4}])
        assert.throws(() => access.verify(assertion(change), entry, key, 'credential'));
    assert.throws(() => access.verify(assertion(), entry, key, 'credential', 1));
    assert.throws(() => access.verify(assertion(), entry, key, 'other'));
});
test('rejects signatures from another key', () => {
    const other = crypto.generateKeyPairSync('ec', {namedCurve:'prime256v1'}).publicKey.export({format:'der',type:'spki'}).toString('base64url');
    assert.throws(() => access.verify(assertion(), entry, other, 'credential'));
});
test('single-use proof binds owner and operation', () => {
    const id = access.issue({kind:'attendance',owner:'42',dni:'11111111'});
    assert.equal(access.take(id,'42','attendance').dni,'11111111');
    assert.throws(() => access.take(id,'42','attendance'));
    assert.throws(() => access.take(access.issue({kind:'attendance',owner:'42'}),'99','attendance'));
    assert.throws(() => access.take(access.issue({kind:'register',owner:'42'}),'42','attendance'));
});
test('enrollment ticket binds the DNI', () => {
    assert.throws(() => access.claim(access.issue({kind:'enrolled',owner:'42',dni:'11111111'}),'42','22222222'));
});
test('only configured secure origins are accepted', () => {
    assert.equal(access.context({headers:{origin:'http://localhost:8081'}}).rpID,'localhost');
    assert.throws(() => access.context({headers:{origin:'http://192.168.1.50:8081'}}));
    assert.throws(() => access.context({headers:{origin:'https://attacker.example'}}));
});

test('enrollment and attendance endpoints complete only with signed single-use proofs', async () => {
    const db = require('../src/config/database');
    const original = db.execute;
    let stored;
    db.execute = async (sql, args) => {
        if (sql.startsWith('CREATE TABLE')) return [];
        if (sql.startsWith('SELECT d.')) return [[stored]];
        if (sql.startsWith('UPDATE socio_dispositivos')) { stored.counter = args[0]; return [{affectedRows:1}]; }
        throw new Error('Unexpected query');
    };
    try {
        const router = require('../src/routes/deviceRoutes');
        async function call(path, body) {
            let data, status = 200;
            const res = {status(code){status=code;return this;},json(value){data=value;return this;}};
            const route = router.stack.find(layer => layer.route?.path === path).route;
            await route.stack[0].handle({body,auth:{id:42,rol:'admin'},headers:{origin:entry.origin}},res);
            return {data,status};
        }
        const created = await call('/register/options',{dni:'11111111'});
        assert.equal(created.status,200);
        const proof = await call('/register/proof',{ceremony:created.data.ceremony,credentialId:'credential',publicKey:key});
        const enrolled = await call('/register/verify',{ceremony:proof.data.ceremony,assertion:assertion({challenge:proof.data.challenge})});
        assert.equal(enrolled.status,200);
        const device = access.claim(enrolled.data.ticket,'42','11111111');
        stored = {usuario_id:7,dni:'11111111',credential_id:device.credentialId,public_key:device.publicKey,counter:device.counter};
        const opts = await call('/authenticate/options',{dni:'11111111'});
        const signed = assertion({challenge:opts.data.challenge,count:2});
        const verified = await call('/authenticate/verify',{ceremony:opts.data.ceremony,assertion:signed});
        assert.equal(verified.status,200);
        assert.equal(access.take(verified.data.proof,'42','attendance').dni,'11111111');
        assert.equal((await call('/authenticate/verify',{ceremony:opts.data.ceremony,assertion:signed})).status,400);
        assert.equal(stored.counter,2);
    } finally { db.execute = original; }
});

test('check-in rejects a DNI without device confirmation before touching attendance', async () => {
    const controller = require('../src/controllers/CheckInController');
    let status, body;
    const res = {status(code){status=code;return this;},json(value){body=value;return this;}};
    await controller.biometricCheckIn({auth:{id:42},body:{dni:'11111111'}},res);
    assert.equal(status,403);
    assert.ok(body.message);
});

test('profile editing updates personal data without changing membership or password', async () => {
    const db = require('../src/config/database');
    const original = db.getConnection;
    const calls = [];
    db.getConnection = async () => ({
        beginTransaction:async()=>calls.push('begin'),commit:async()=>calls.push('commit'),rollback:async()=>calls.push('rollback'),release:()=>{},
        execute:async(sql,args)=>{calls.push({sql,args});return sql.startsWith('SELECT') ? [[{id:7}]] : [{affectedRows:1}];},
    });
    try {
        const controller = require('../src/controllers/SocioController');
        let status=200;
        const res={status(code){status=code;return this;},json(){return this;}};
        await controller.updateSocio({params:{id:7},auth:{id:42},body:{dni:'11111111',nombre:'Socio',apellido:'Prueba',email:'test@example.com',telefono:'999999999',planId:999,password_hash:'ignored'}},res);
        assert.equal(status,200);
        assert.equal(calls.at(-1),'commit');
        const update = calls.find(item=>item.sql?.startsWith('UPDATE'));
        assert.deepEqual(update.args,['11111111','Socio','Prueba','test@example.com','999999999',7]);
        assert.equal(calls.filter(item=>item.sql).length,2);
    } finally { db.getConnection = original; }
});

test('1-touch fingerprint authentication automatically identifies member without DNI', async () => {
    const db = require('../src/config/database');
    const original = db.execute;
    const stored = { usuario_id: 8, dni: '88888888', nombre: 'Carlos', apellido: 'Panda', credential_id: 'cred-888', public_key: key, counter: 0 };
    db.execute = async (sql, args) => {
        if (sql.startsWith('CREATE TABLE')) return [];
        if (sql.includes('FROM socio_dispositivos d') && sql.includes('WHERE d.credential_id=?')) return [[stored]];
        if (sql.includes('SELECT d.credential_id FROM socio_dispositivos d')) return [[{ credential_id: 'cred-888' }]];
        if (sql.startsWith('UPDATE socio_dispositivos')) { stored.counter = args[0]; return [{ affectedRows: 1 }]; }
        throw new Error('Unexpected query: ' + sql);
    };
    try {
        const router = require('../src/routes/deviceRoutes');
        async function call(path, body) {
            let data, status = 200;
            const res = { status(code) { status = code; return this; }, json(val) { data = val; return this; } };
            const route = router.stack.find(layer => layer.route?.path === path).route;
            await route.stack[0].handle({ body, auth: { id: 42, rol: 'admin' }, headers: { origin: entry.origin } }, res);
            return { data, status };
        }
        // Step 1: Request options with NO DNI
        const opts = await call('/authenticate/options', {});
        assert.equal(opts.status, 200);
        assert.ok(opts.data.challenge);
        assert.deepEqual(opts.data.credentialIds, ['cred-888']);

        // Step 2: Member touches sensor / phone, returns signed assertion with credential id 'cred-888'
        const signed = assertion({ challenge: opts.data.challenge, count: 1 });
        signed.id = 'cred-888';
        const verified = await call('/authenticate/verify', { ceremony: opts.data.ceremony, assertion: signed });
        assert.equal(verified.status, 200);
        assert.equal(verified.data.dni, '88888888');
        assert.equal(verified.data.user.nombre, 'Carlos');
        assert.equal(access.take(verified.data.proof, '42', 'attendance').dni, '88888888');
    } finally { db.execute = original; }
});

