const { test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const db = require('../src/config/database');
const email = require('../src/utils/email');
const sent = [];
let delivery = true;
email.sendEmail = async message => { sent.push(message); return delivery; };
const SocioModel = require('../src/models/SocioModel');
const UserModel = require('../src/models/UserModel');
const SocioController = require('../src/controllers/SocioController');
const AuthController = require('../src/controllers/AuthController');
const access = require('../src/services/roleAccess');
const middleware = require('../src/middleware/authMiddleware');
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const form = { dni:'11223344',nombre:'Socio',apellido:'Prueba',email:'member@example.com',telefono:'999999999',planId:1,fechaInicio:'2026-10-13' };

test('new member always gets a hashed DNI password and client role, even if a password is submitted', async t => {
  const get = db.getConnection, execute = db.execute;
  t.after(() => { db.getConnection = get; db.execute = execute; });
  let insert, committed = false;
  db.getConnection = async () => ({
    beginTransaction: async () => {}, commit: async () => { committed = true; }, rollback: async () => {}, release() {},
    execute: async (sql, args) => {
      if (sql.includes('SELECT id FROM roles')) return [[{id:2}]];
      if (sql.includes('SELECT id, duracion_dias')) return [[{id:1,duracion_dias:30,precio:80}]];
      if (sql.includes('INSERT INTO usuarios')) { insert = args; return [{insertId:10}]; }
      return [{insertId:20}];
    },
  });
  db.execute = async sql => sql.includes('SELECT nombre FROM planes') ? [[{nombre:'Mensual'}]] : [[]];
  const res = response();
  await SocioController.createSocio({body:{...form,password:'IgnoredPassword123',rolId:1},auth:{id:1}}, res);
  assert.equal(res.statusCode,201);
  assert.equal(insert[6],2);
  assert.notEqual(insert[4],form.dni);
  assert.ok(await bcrypt.compare(form.dni,insert[4]));
  assert.equal(await bcrypt.compare('IgnoredPassword123',insert[4]),false);
  assert.equal(committed,true);
  assert.equal(res.body.socio.password,undefined);
  assert.equal(res.body.socio.password_hash,undefined);
});

test('email is required and validated when creating or editing a member', async () => {
  for (const email of ['', 'not-an-email']) {
    let res = response();
    await SocioController.createSocio({body:{...form,email},auth:{id:1}},res);
    assert.equal(res.statusCode,400);
    res = response();
    await SocioController.updateSocio({params:{id:10},body:{...form,email},auth:{id:1}},res);
    assert.equal(res.statusCode,400);
  }
});

test('editing a member never changes or retrieves the stored password', async t => {
  const original = db.getConnection, writes = [];
  t.after(() => { db.getConnection = original; });
  db.getConnection = async () => ({beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release(){},execute:async(sql,args)=>{
    writes.push({sql,args}); return sql.startsWith('SELECT') ? [[{id:10}]] : [{affectedRows:1}];
  }});
  const res = response();
  await SocioController.updateSocio({params:{id:10},body:{...form,password:'MustBeIgnored'},auth:{id:1}},res);
  assert.equal(res.statusCode,200);
  assert.ok(writes.some(item=>item.sql.startsWith('UPDATE usuarios')));
  assert.ok(writes.every(item=>!item.sql.includes('password_hash')));
});

test('deactivation blocks login and existing tokens; reactivation restores member access without changing memberships', async t => {
  const execute = db.execute, identity = access.identity, decorate = access.decorate;
  t.after(() => { db.execute = execute; access.identity = identity; access.decorate = decorate; });
  const user = {id:10,...form,activo:1,rol:'cliente',password_hash:await bcrypt.hash(form.dni,4)};
  const writes = [];
  db.execute = async (sql,args) => {
    if (sql.startsWith('UPDATE usuarios u JOIN roles')) {
      writes.push(sql);
      assert.match(sql,/r.nombre='cliente'/);
      if (args[1] !== user.id) return [{affectedRows:0}];
      user.activo = args[0]; return [{affectedRows:1}];
    }
    assert.match(sql,/u\.dni = \? AND u\.activo = 1/);
    return [user.activo && args[0] === user.dni ? [user] : []];
  };
  access.identity = async () => user.activo ? {id:user.id,rol:'cliente',permissions:['mi-pandita','asistencias']} : null;
  access.decorate = async publicUser => ({...publicUser,permissions:['mi-pandita','asistencias']});
  const login = async () => { const res=response();await AuthController.login({body:{dni:form.dni,password:form.dni}},res);return res; };
  let res = await login();
  assert.equal(res.statusCode,200);
  assert.equal(res.body.user.rol,'cliente');
  assert.equal(res.body.user.password_hash,undefined);
  const token = res.body.token;
  res = response();await SocioController.setActive({params:{id:10},body:{activo:false}},res);
  assert.equal(res.statusCode,200);
  assert.equal((await login()).statusCode,401);
  res = response();let allowed=false;
  await middleware.authenticateToken({headers:{authorization:`Bearer ${token}`},originalUrl:'/api/auth/me'},res,()=>{allowed=true;});
  assert.equal(res.statusCode,401);assert.equal(allowed,false);
  res=response();await SocioController.setActive({params:{id:10},body:{activo:true}},res);
  assert.equal(res.statusCode,200);assert.equal((await login()).statusCode,200);
  assert.ok(writes.every(sql=>!sql.includes('membresias')));
  for (const body of [{activo:'false'},{activo:0},{}]) {
    res=response();await SocioController.setActive({params:{id:10},body},res);assert.equal(res.statusCode,400);
  }
  res=response();await SocioController.setActive({params:{id:1},body:{activo:false}},res);assert.equal(res.statusCode,404);
  res=response();middleware.requireRole('admin')({auth:{rol:'cliente'}},res,()=>{throw Error('client was allowed');});assert.equal(res.statusCode,403);
});

test('member can change their own password only with the correct current password', async t => {
  const find=UserModel.findActiveById, update=UserModel.updatePasswordHash;
  t.after(()=>{UserModel.findActiveById=find;UserModel.updatePasswordHash=update;});
  const user={id:10,password_hash:await bcrypt.hash(form.dni,4)};
  UserModel.findActiveById=async()=>user;
  UserModel.updatePasswordHash=async(id,hash)=>{assert.equal(id,10);user.password_hash=hash;};
  let res=response();await AuthController.changePassword({auth:{id:10},body:{currentPassword:'incorrect',newPassword:'NewPassword123'}},res);assert.equal(res.statusCode,401);
  res=response();await AuthController.changePassword({auth:{id:10},body:{currentPassword:form.dni,newPassword:'NewPassword123'}},res);
  assert.equal(res.statusCode,200);assert.ok(await bcrypt.compare('NewPassword123',user.password_hash));
  assert.equal(await bcrypt.compare(form.dni,user.password_hash),false);
});

test('recovery sends the code only by email; rejects wrong or expired codes and consumes successful codes', async t => {
  const names=['GOOGLE_USER','GOOGLE_APP_PASSWORD','SMTP_HOST','SMTP_USER','SMTP_PASS'];
  const env=Object.fromEntries(names.map(key=>[key,process.env[key]]));
  const methods=['findActiveByDniOrEmail','saveResetCode','clearResetCode','updatePasswordHash'];
  const original=Object.fromEntries(methods.map(key=>[key,UserModel[key]]));
  t.after(()=>{for(const key of names){if(env[key]===undefined)delete process.env[key];else process.env[key]=env[key];}Object.assign(UserModel,original);delivery=true;});
  const user={id:10,...form};
  UserModel.findActiveByDniOrEmail=async()=>user;
  UserModel.saveResetCode=async(id,code,expires)=>{user.reset_code=code;user.reset_expires=expires;};
  UserModel.clearResetCode=async()=>{user.reset_code=null;user.reset_expires=null;};
  UserModel.updatePasswordHash=async(id,hash)=>{user.password_hash=hash;};
  for(const key of names)delete process.env[key];
  let res=response();await AuthController.forgotPassword({body:{identifier:form.dni}},res);assert.equal(res.statusCode,503);
  process.env.SMTP_HOST='smtp.example.com';process.env.SMTP_USER='test';process.env.SMTP_PASS='test';
  res=response();await AuthController.forgotPassword({body:{identifier:form.dni}},res);
  assert.equal(res.statusCode,200);assert.equal(res.body.devCode,undefined);
  assert.match(user.reset_code,/^\d{6}$/);
  assert.equal(sent.at(-1).to,form.email);assert.ok(sent.at(-1).html.includes(user.reset_code));
  const code=user.reset_code;
  const reset=async code=>{const res=response();await AuthController.resetPassword({body:{identifier:form.dni,code,newPassword:'Recovered123'}},res);return res;};
  assert.equal((await reset('000000')).statusCode,400);
  user.reset_expires=new Date(Date.now()-1000);assert.equal((await reset(code)).statusCode,400);
  user.reset_expires=new Date(Date.now()+60000);assert.equal((await reset(code)).statusCode,200);
  assert.ok(await bcrypt.compare('Recovered123',user.password_hash));assert.equal(user.reset_code,null);
  assert.equal((await reset(code)).statusCode,400);
  delivery=false;res=response();await AuthController.forgotPassword({body:{identifier:form.dni}},res);
  assert.equal(res.statusCode,503);assert.equal(user.reset_code,null);
});
