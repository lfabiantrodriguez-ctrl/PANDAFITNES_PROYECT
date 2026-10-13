const {test}=require('node:test');
const assert=require('node:assert/strict');
const jwt=require('jsonwebtoken');
const access=require('../src/services/roleAccess');
const router=require('../src/routes/staffRoutes');
const db=require('../src/config/database');
const actor={id:1,rol:'admin',permissions:access.KEYS};
const userForm={dni:'11111111',nombre:'Personal',apellido:'Prueba',email:'staff@example.com',telefono:'999999999',rolId:3,activo:true,password:'Password123'};
function response(){return {statusCode:200,body:null,status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}};}
async function route(method,path,body,params={},auth=actor){
 const layer=router.stack.find(s=>s.route?.path===path&&s.route.methods[method]);
 const res=response();await layer.route.stack[0].handle({body,params,auth},res);return res;
}
test('roles reject reserved names and invented screens',()=>{
 assert.throws(()=>router.validateRole({etiqueta:'Cliente',permissions:['socios']}));
 assert.throws(()=>router.validateRole({etiqueta:'Admin',permissions:['socios']}));
 assert.throws(()=>router.validateRole({etiqueta:'Recepción',permissions:['not-real']}));
 assert.deepEqual(router.validateRole({etiqueta:'Recepción',permissions:['socios','socios']}).permissions,['socios']);
});
test('staff users require a valid DNI, password and activation flag',()=>{
 assert.equal(router.validateUser(userForm,true).dni,'11111111');
 for(const patch of [{dni:'a'},{password:'weak'},{activo:'true'},{rolId:0},{email:'bad'}])assert.throws(()=>router.validateUser({...userForm,...patch},true));
 assert.doesNotThrow(()=>router.validateUser({...userForm,password:''},false));
});
test('granting permissions cannot escalate privileges',()=>{
 const manager={rol:'recepcion',permissions:['usuarios','socios']};
 assert.equal(access.mayGrant(manager,'ventas',['socios']),true);
 assert.equal(access.mayGrant(manager,'ventas',['configuracion']),false);
 assert.equal(access.mayGrant(manager,'admin',['socios']),false);
 assert.equal(access.mayGrant(actor,'cliente',[]),false);
});
test('custom role sees only its permitted API and its own profile',()=>{
 const auth={rol:'recepcion',permissions:['socios']};
 assert.equal(access.canRequest(auth,{originalUrl:'/api/admin/socios'}),true);
 for(const url of ['/api/admin/usuarios','/api/admin/checkin/confirm','/api/configuracion','/api/unknown'])assert.equal(access.canRequest(auth,{originalUrl:url}),false);
 assert.equal(access.canRequest(auth,{originalUrl:'/api/auth/me'}),true);
 assert.equal(access.canRequest({rol:'recepcion',permissions:['check-in']},{originalUrl:'/api/admin/dispositivos/simulate/register'}),false);
});
test('JWT role is ignored; current role and active state control access',async()=>{
 const middleware=require('../src/middleware/authMiddleware'),original=access.identity;
 const token=jwt.sign({id:7,rol:'admin'},require('../src/utils/helpers').JWT_SECRET);
 const req=()=>({headers:{authorization:`Bearer ${token}`},originalUrl:'/api/admin/usuarios'});
 try{
  access.identity=async()=>({id:7,rol:'recepcion',permissions:['socios']});
  let next=false;let res=response();await middleware.authenticateToken(req(),res,()=>{next=true});assert.equal(res.statusCode,403);assert.equal(next,false);
  access.identity=async()=>null;res=response();await middleware.authenticateToken(req(),res,()=>{});assert.equal(res.statusCode,401);
  access.identity=async()=>actor;res=response();await middleware.authenticateToken(req(),res,()=>{next=true});assert.equal(next,true);
 }finally{access.identity=original;}
});
test('client is explicitly blocked from staff administration',()=>{
 const middleware=require('../src/middleware/authMiddleware');const res=response();let next=false;
 middleware.requirePermission('usuarios')({auth:{rol:'cliente',permissions:['usuarios']}},res,()=>{next=true});assert.equal(res.statusCode,403);assert.equal(next,false);
});
test('creating a user with client role rolls back without inserts',async()=>{
 const original=db.getConnection,calls=[];
 db.getConnection=async()=>({beginTransaction:async()=>{},commit:async()=>calls.push('commit'),rollback:async()=>calls.push('rollback'),release:()=>{},execute:async(sql)=>{calls.push(sql);return sql.includes('a.permisos')?[[{id:3,nombre:'cliente'}]]:[[]];}});
 try{const res=await route('post','/',userForm);assert.equal(res.statusCode,400);assert.match(res.body.message,/prohibido/);assert.ok(calls.includes('rollback'));assert.ok(!calls.some(c=>c.startsWith('INSERT')));}finally{db.getConnection=original;}
});
test('creating staff stores a hashed password and the selected role',async()=>{
 const original=db.getConnection,calls=[];
 db.getConnection=async()=>({beginTransaction:async()=>{},commit:async()=>calls.push('commit'),rollback:async()=>calls.push('rollback'),release:()=>{},execute:async(sql,args)=>{calls.push({sql,args});if(sql.includes('a.permisos'))return [[{id:3,nombre:'recepcion',permisos:'["socios"]'}]];if(sql.startsWith('INSERT INTO usuarios'))return [{insertId:50}];return [[]];}});
 try{const res=await route('post','/',userForm);assert.equal(res.statusCode,201);assert.equal(res.body.id,50);const insert=calls.find(c=>c.sql?.startsWith('INSERT INTO usuarios'));assert.equal(insert.args[5],3);assert.notEqual(insert.args[7],userForm.password);assert.ok(await require('bcrypt').compare(userForm.password,insert.args[7]));assert.ok(calls.includes('commit'));}finally{db.getConnection=original;}
});
test('cannot disable or change the current account role',async()=>{
 const original=db.getConnection,calls=[];
 db.getConnection=async()=>({beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>calls.push('rollback'),release:()=>{},execute:async(sql)=>{calls.push(sql);if(sql.includes('a.permisos'))return [[{id:3,nombre:'admin'}]];if(sql.includes('u.rol_id,r.nombre'))return [[{id:1,rol_id:3,rol:'admin'}]];return [[]];}});
 try{const res=await route('put','/:id',{...userForm,password:'',activo:false},{id:1});assert.equal(res.statusCode,400);assert.match(res.body.message,/tu cuenta/);assert.ok(!calls.some(c=>c.startsWith('UPDATE usuarios')));}finally{db.getConnection=original;}
});
test('last administrator cannot be removed',async()=>{
 const original=db.getConnection;
 db.getConnection=async()=>({beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release:()=>{},execute:async(sql)=>{
  if(sql.includes('a.permisos'))return [[{id:3,nombre:'recepcion',permisos:'["socios"]'}]];
  if(sql.includes('u.rol_id,r.nombre'))return [[{id:8,rol_id:1,rol:'admin'}]];
  return [[]];
 }});
 try{const res=await route('put','/:id',{...userForm,password:''},{id:8});assert.equal(res.statusCode,400);assert.match(res.body.message,/al menos un administrador/);}finally{db.getConnection=original;}
});
test('role permissions are persisted atomically',async()=>{
 const original=db.getConnection,calls=[];
 db.getConnection=async()=>({beginTransaction:async()=>{},commit:async()=>calls.push('commit'),rollback:async()=>{},release:()=>{},execute:async(sql,args)=>{calls.push({sql,args});return [{insertId:11}];}});
 try{const res=await route('post','/roles',{etiqueta:'Recepción',descripcion:'Equipo de recepción',permissions:['socios','check-in']});assert.equal(res.statusCode,201);const insert=calls.find(c=>c.sql?.startsWith('INSERT INTO role_access'));assert.deepEqual(JSON.parse(insert.args[3]),['socios','check-in']);assert.ok(calls.includes('commit'));}finally{db.getConnection=original;}
});
test('frontend and server catalogs match and custom navigation omits hidden windows',async()=>{
 const {STAFF_WINDOWS,canAccess,homeFor,staffSections,moduleLabel}=await import('../../frontend/src/utils/access.js');
 const {MENU_SECTIONS,menuSections}=await import('../../frontend/src/utils/navigation.js');
 assert.deepEqual(STAFF_WINDOWS,access.MODULES);
 for(const module of STAFF_WINDOWS){
  const section=MENU_SECTIONS.admin.find(section=>section.items.some(item=>item.to===`/app/${module.key}`));
  assert.ok(section,`Permission ${module.key} must exist in the real sidebar`);
  assert.equal(section.category,module.group);
  assert.equal(section.items.find(item=>item.to===`/app/${module.key}`).label,module.label);
 }
 for(const user of [{rol:'admin',memberLink:{id:1}},{rol:'recepcion',permissions:STAFF_WINDOWS.map(m=>m.key)},{rol:'cliente'}]){
  const items=menuSections(user).flatMap(section=>section.items);
  assert.equal(items.length,new Set(items.map(item=>item.to)).size);
  for(const item of items)assert.equal(item.label,moduleLabel(item.to.split('/').pop(),user));
 }
 const user={rol:'recepcion',permissions:['socios']};
 assert.equal(canAccess(user,'usuarios'),false);assert.equal(canAccess(user,'perfil'),true);assert.equal(homeFor(user),'/app/socios');
 assert.deepEqual(staffSections(user).flatMap(s=>s.items).map(i=>i.to),['/app/socios','/app/perfil']);
});
