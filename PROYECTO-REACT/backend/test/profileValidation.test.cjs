const {test}=require('node:test');
const assert=require('node:assert/strict');
const {validateProfile}=require('../src/utils/profileValidation');
const db=require('../src/config/database');
const UserModel=require('../src/models/UserModel');
const AuthController=require('../src/controllers/AuthController');
const access=require('../src/services/roleAccess');
const valid={nombre:'María José',apellido:'Núñez Pérez',dni:'11223344',email:'maria+gym@example.com',telefono:'912345678',fecha_nacimiento:'1990-02-28',direccion:'',contacto_emergencia:'',telefono_emergencia:'',avatar_url:'',preferencias:{avisosMembresia:true,novedadesPandita:true,promocionesCorreo:false}};
const response=()=>({statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}});

test('all required identity and contact fields reject empty or whitespace values',()=>{
    assert.deepEqual(validateProfile(valid).errors,{});
    for(const field of ['nombre','apellido','dni','email','telefono','fecha_nacimiento'])for(const value of ['', '   ',null,undefined]){
        assert.ok(validateProfile({...valid,[field]:value}).errors[field],`${field} cannot be cleared`);
    }
});

test('names, DNI, email and phone formats and lengths are validated per field',()=>{
    const invalid={nombre:['Ana123','<Ana>','x'.repeat(101)],apellido:['123','---','x'.repeat(101)],dni:['1234567','123456789','ABCDEFGH'],
        email:['a@b','@example.com','a..b@example.com','a@-example.com','a@example..com','a b@example.com','x'.repeat(65)+'@example.com'],telefono:['123456789','91234567','9123456789','abcdefghj']};
    for(const [field,values] of Object.entries(invalid))for(const value of values)assert.ok(validateProfile({...valid,[field]:value}).errors[field],`${field}: ${value}`);
    assert.deepEqual(validateProfile({...valid,nombre:'Jean-Luc',apellido:'O’Connor',dni:'00000000'}).errors,{});
});

test('birth dates must be real calendar dates, within range, and not in the future',()=>{
    for(const date of ['2023-02-29','2024-02-30','1900-02-29','2026-13-01','2026-01-32','2026-10-14','1899-12-31','13/10/2000'])
        assert.ok(validateProfile({...valid,fecha_nacimiento:date},'2026-10-13').errors.fecha_nacimiento,date);
    for(const date of ['2024-02-29','1900-01-01','2026-10-13'])assert.equal(validateProfile({...valid,fecha_nacimiento:date},'2026-10-13').errors.fecha_nacimiento,undefined,date);
});

test('optional fields stay optional, but incomplete emergency contacts and invalid photos are rejected',()=>{
    assert.deepEqual(validateProfile(valid).errors,{});
    assert.ok(validateProfile({...valid,direccion:'x'.repeat(256)}).errors.direccion);
    assert.ok(validateProfile({...valid,contacto_emergencia:'Ana Torres'}).errors.telefono_emergencia);
    assert.ok(validateProfile({...valid,telefono_emergencia:'987654321'}).errors.contacto_emergencia);
    assert.ok(validateProfile({...valid,contacto_emergencia:'123',telefono_emergencia:'987654321'}).errors.contacto_emergencia);
    assert.deepEqual(validateProfile({...valid,contacto_emergencia:'Ana Torres - Hermana',telefono_emergencia:'987654321'}).errors,{});
    assert.ok(validateProfile({...valid,avatar_url:'javascript:alert(1)'}).errors.avatar_url);
    assert.ok(validateProfile({...valid,avatar_url:'data:image/svg+xml;base64,AAAA'}).errors.avatar_url);
    assert.ok(validateProfile({...valid,preferencias:{avisosMembresia:'true'}}).errors.preferencias);
});

test('frontend and backend apply the same rules and normalization',async()=>{
    const browser=await import('../../frontend/src/utils/profileValidation.js');
    const cases=[valid,{}, {...valid,dni:''},{...valid,nombre:' José  Luis ',email:' MARIA@EXAMPLE.COM '},
        {...valid,fecha_nacimiento:'2023-02-29'},{...valid,telefono:'123'}, {...valid,contacto_emergencia:'Ana'}, {...valid,preferencias:[]}];
    for(const data of cases)assert.deepEqual(browser.validateProfile(data,'2026-10-13'),validateProfile(data,'2026-10-13'));
});

test('invalid profile submissions return field errors before any database writes or fallback to an old DNI',async t=>{
    const execute=db.execute,update=UserModel.updateProfile;
    t.after(()=>{db.execute=execute;UserModel.updateProfile=update;});
    let touched=false;db.execute=async()=>{touched=true;throw Error('DB must not be called');};UserModel.updateProfile=async()=>{touched=true;};
    const res=response();await AuthController.updateMe({auth:{id:1},body:{...valid,dni:'',nombre:'',email:'bad',fecha_nacimiento:'2099-01-01'}},res);
    assert.equal(res.statusCode,400);
    for(const key of ['dni','nombre','email','fecha_nacimiento'])assert.ok(res.body.errors[key]);
    assert.equal(touched,false);
});

test('duplicates on active or inactive accounts are returned beside both conflicting fields without writing',async t=>{
    const execute=db.execute,find=UserModel.findActiveById,update=UserModel.updateProfile;
    t.after(()=>{db.execute=execute;UserModel.findActiveById=find;UserModel.updateProfile=update;});
    let written=false;
    UserModel.findActiveById=async()=>({id:1});UserModel.updateProfile=async()=>{written=true;};
    db.execute=async sql=>sql.includes('AND activo = 1')?[[]]:[[{id:2,activo:0}]];
    const res=response();await AuthController.updateMe({auth:{id:1},body:valid},res);
    assert.equal(res.statusCode,409);assert.ok(res.body.errors.dni);assert.ok(res.body.errors.email);assert.equal(written,false);
});

test('valid profile saves normalized data and returns the updated identity without accepting role changes',async t=>{
    const execute=db.execute,find=UserModel.findActiveById,update=UserModel.updateProfile,decorate=access.decorate;
    t.after(()=>{db.execute=execute;UserModel.findActiveById=find;UserModel.updateProfile=update;access.decorate=decorate;});
    let saved;
    db.execute=async()=>[[]];UserModel.findActiveById=async()=>({id:1,rol:'admin',...valid,...saved});
    UserModel.updateProfile=async(id,data)=>{assert.equal(id,1);saved=data;return true;};access.decorate=async user=>user;
    const res=response();await AuthController.updateMe({auth:{id:1},body:{...valid,nombre:' María  José ',email:' MARIA@EXAMPLE.COM ',rol:'cliente',activo:false}},res);
    assert.equal(res.statusCode,200);assert.equal(saved.nombre,'María José');assert.equal(saved.email,'maria@example.com');
    assert.equal(saved.dni,valid.dni);assert.equal(saved.rol,undefined);assert.equal(saved.activo,undefined);assert.equal(res.body.user.rol,'admin');
});

test('a concurrent duplicate error remains a field-level response, not an internal error',async t=>{
    const execute=db.execute,find=UserModel.findActiveById,update=UserModel.updateProfile;
    t.after(()=>{db.execute=execute;UserModel.findActiveById=find;UserModel.updateProfile=update;});
    db.execute=async()=>[[]];UserModel.findActiveById=async()=>({id:1});
    UserModel.updateProfile=async()=>{throw Object.assign(new Error('Duplicate'),{code:'ER_DUP_ENTRY',sqlMessage:"Duplicate entry for key 'usuarios.dni'"});};
    const res=response();await AuthController.updateMe({auth:{id:1},body:valid},res);assert.equal(res.statusCode,409);assert.ok(res.body.errors.dni);
});
