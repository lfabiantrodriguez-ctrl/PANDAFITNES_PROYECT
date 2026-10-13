const router=require('express').Router();
const db=require('../config/database');
const bcrypt=require('bcrypt');
const access=require('../services/roleAccess');
const {authenticateToken,requirePermission}=require('../middleware/authMiddleware');
router.use(authenticateToken,requirePermission('usuarios'));
const wrap=fn=>async(req,res)=>{try{await fn(req,res);}catch(e){console.error('Usuarios y roles:',e.message);const duplicate=e.code==='ER_DUP_ENTRY';res.status(duplicate?409:e.code?503:400).json({message:duplicate?'Ya existe un registro con ese DNI, correo o nombre de rol.':e.code?'No se pudo acceder a los datos. Vuelve a intentarlo.':e.message});}};
function roleData(body) {
    const etiqueta=String(body.etiqueta||'').trim(),descripcion=String(body.descripcion||'').trim();
    const nombre=etiqueta.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,'_');
    if(etiqueta.length<3 || etiqueta.length>50 || !/^[a-z][a-z0-9_-]{2,49}$/.test(nombre) || ['admin','cliente'].includes(nombre))throw new Error('Usa un nombre de rol válido, diferente de Admin y Cliente.');
    if(descripcion.length>255)throw new Error('La descripción admite hasta 255 caracteres.');
    if(!Array.isArray(body.permissions)||!body.permissions.length||body.permissions.some(p=>!access.KEYS.includes(p)))throw new Error('Selecciona al menos una ventana válida.');
    return {nombre,etiqueta,descripcion,permissions:[...new Set(body.permissions)]};
}
function userData(body,creating) {
    const value={dni:String(body.dni||'').trim(),nombre:String(body.nombre||'').trim(),apellido:String(body.apellido||'').trim(),email:String(body.email||'').trim().toLowerCase(),telefono:String(body.telefono||'').trim(),rolId:Number(body.rolId),activo:body.activo,password:body.password||''};
    if(!/^\d{8}$/.test(value.dni))throw new Error('El DNI debe tener 8 dígitos.');
    if(!/^[\p{L}\p{M} '\-]{1,100}$/u.test(value.nombre)||!/^[\p{L}\p{M} '\-]{1,100}$/u.test(value.apellido))throw new Error('Revisa los nombres y apellidos.');
    if(value.email.length>150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email))throw new Error('Ingresa un correo válido.');
    if(value.telefono && !/^\d{9}$/.test(value.telefono))throw new Error('El teléfono debe tener 9 dígitos.');
    if(!Number.isInteger(value.rolId)||value.rolId<1||typeof value.activo!=='boolean')throw new Error('Selecciona un rol y un estado válidos.');
    if(typeof value.password!=='string'||Buffer.byteLength(value.password)>72||(creating&&!value.password)||(value.password&&!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,72}$/.test(value.password)))throw new Error('La contraseña debe tener de 8 a 72 caracteres, mayúscula, minúscula y número.');
    return value;
}
router.get('/',wrap(async(req,res)=>{
    await access.init();
    const [roles]=await db.execute(`SELECT r.id,r.nombre,a.etiqueta,a.descripcion,a.permisos,
        (SELECT COUNT(*) FROM usuarios u WHERE u.rol_id=r.id) AS usuarios FROM roles r LEFT JOIN role_access a ON a.rol_id=r.id WHERE r.nombre<>'cliente' ORDER BY r.nombre='admin' DESC,r.nombre`);
    const [users]=await db.execute(`SELECT u.id,u.dni,u.nombre,u.apellido,u.email,u.telefono,u.avatar_url,u.activo,u.rol_id AS rolId,r.nombre AS rol,
        COALESCE(a.etiqueta,r.nombre) AS roleLabel FROM usuarios u JOIN roles r ON r.id=u.rol_id LEFT JOIN role_access a ON a.rol_id=r.id WHERE r.nombre<>'cliente' ORDER BY u.id DESC`);
    res.json({users:users.map(u=>({...u,activo:Boolean(u.activo)})),roles:roles.map(r=>({id:r.id,nombre:r.nombre,etiqueta:r.etiqueta||(r.nombre==='admin'?'Administrador':r.nombre),descripcion:r.descripcion||'',permissions:access.permissions(r.nombre,r.permisos),usuarios:Number(r.usuarios),protected:r.nombre==='admin'})),modules:access.MODULES});
}));
async function saveRole(req,res,editing) {
    const data=roleData(req.body);
    if(!access.mayGrant(req.auth,data.nombre,data.permissions))throw new Error('Solo puedes asignar permisos que tú ya tienes.');
    const connection=await db.getConnection();
    try{
        await connection.beginTransaction();
        let id=Number(req.params.id);
        if(editing){
            if(!Number.isInteger(id)||id<1)throw new Error('El rol seleccionado no es válido.');
            const [rows]=await connection.execute('SELECT id,nombre FROM roles WHERE id=? FOR UPDATE',[id]);
            if(!rows[0]||['admin','cliente'].includes(rows[0].nombre))throw new Error('No se puede modificar este rol del sistema.');
            if(req.auth.rol!=='admin'&&rows[0].nombre===req.auth.rol)throw new Error('No puedes modificar los permisos de tu propio rol.');
            await connection.execute('UPDATE roles SET nombre=? WHERE id=?',[data.nombre,id]);
        }else{
            const [result]=await connection.execute('INSERT INTO roles (nombre) VALUES (?)',[data.nombre]);id=result.insertId;
        }
        await connection.execute(`INSERT INTO role_access (rol_id,etiqueta,descripcion,permisos) VALUES (?,?,?,?)
            ON DUPLICATE KEY UPDATE etiqueta=VALUES(etiqueta),descripcion=VALUES(descripcion),permisos=VALUES(permisos)`,[id,data.etiqueta,data.descripcion,JSON.stringify(data.permissions)]);
        await connection.commit();res.status(editing?200:201).json({message:editing?'Rol actualizado. Los permisos se aplican a sus usuarios.':'Rol creado.',id});
    }catch(e){await connection.rollback();throw e;}finally{connection.release();}
}
router.post('/roles',wrap((req,res)=>saveRole(req,res,false)));
router.put('/roles/:id',wrap((req,res)=>saveRole(req,res,true)));
async function saveUser(req,res,editing) {
    const data=userData(req.body,!editing);
    const hash=data.password?await bcrypt.hash(data.password,12):null;
    const connection=await db.getConnection();
    try{
        await connection.beginTransaction();
        // Serialize changes to the administrator roster so concurrent edits cannot remove the last one.
        await connection.execute("SELECT id FROM roles WHERE nombre='admin' FOR UPDATE");
        const [roles]=await connection.execute(`SELECT r.id,r.nombre,a.permisos FROM roles r LEFT JOIN role_access a ON a.rol_id=r.id WHERE r.id=?`,[data.rolId]);
        const role=roles[0];
        if(!role||role.nombre==='cliente')throw new Error('Está prohibido crear o convertir clientes desde Usuarios y roles. Usa Gestión de socios.');
        if(!access.mayGrant(req.auth,role.nombre,access.permissions(role.nombre,role.permisos)))throw new Error('No puedes asignar este rol.');
        let id=Number(req.params.id);
        if(editing){
            if(!Number.isInteger(id)||id<1)throw new Error('El usuario seleccionado no es válido.');
            const [rows]=await connection.execute(`SELECT u.id,u.rol_id,r.nombre AS rol FROM usuarios u JOIN roles r ON r.id=u.rol_id WHERE u.id=? FOR UPDATE`,[id]);
            const target=rows[0];
            if(!target||target.rol==='cliente')throw new Error('Solo se pueden editar usuarios del personal.');
            if(target.rol==='admin'&&req.auth.rol!=='admin')throw new Error('Solo un administrador puede modificar administradores.');
            if(id===Number(req.auth.id)&&(!data.activo||data.rolId!==Number(target.rol_id)))throw new Error('No puedes desactivar tu cuenta ni cambiar tu propio rol desde este módulo.');
            if(target.rol==='admin'&&(!data.activo||role.nombre!=='admin')){
                const [remaining]=await connection.execute(`SELECT id FROM usuarios WHERE rol_id=? AND activo=1 AND id<>? FOR UPDATE`,[target.rol_id,id]);
                if(!remaining.length)throw new Error('Debe quedar al menos un administrador activo.');
            }
            await connection.execute('UPDATE usuarios SET dni=?,nombre=?,apellido=?,email=?,telefono=?,rol_id=?,activo=? WHERE id=?',[data.dni,data.nombre,data.apellido,data.email,data.telefono||null,data.rolId,data.activo?1:0,id]);
            if(hash)await connection.execute('UPDATE usuarios SET password_hash=? WHERE id=?',[hash,id]);
        }else{
            const [result]=await connection.execute('INSERT INTO usuarios (dni,nombre,apellido,email,telefono,rol_id,activo,password_hash) VALUES (?,?,?,?,?,?,?,?)',[data.dni,data.nombre,data.apellido,data.email,data.telefono||null,data.rolId,data.activo?1:0,hash]);id=result.insertId;
        }
        await connection.commit();res.status(editing?200:201).json({message:editing?'Usuario actualizado.':'Usuario creado.',id});
    }catch(e){await connection.rollback();throw e;}finally{connection.release();}
}
router.post('/',wrap((req,res)=>saveUser(req,res,false)));
router.put('/:id',wrap((req,res)=>saveUser(req,res,true)));
module.exports=router;
module.exports.validateRole=roleData;
module.exports.validateUser=userData;
