const db = require('../config/database');
const MODULES = [
    {key:'inicio',label:'Inicio',icon:'bi-grid',group:'ADMINISTRACIÓN & RECEPCIÓN'},
    {key:'check-in',label:'Control de acceso (check-in)',icon:'bi-fingerprint',group:'ADMINISTRACIÓN & RECEPCIÓN'},
    {key:'socios',label:'Gestión de socios & membresías',icon:'bi-people',group:'ADMINISTRACIÓN & RECEPCIÓN'},
    {key:'invitados',label:'Clientes diarios',icon:'bi-ticket-perforated',group:'ADMINISTRACIÓN & RECEPCIÓN'},
    {key:'aforo',label:'Control de aforo',icon:'bi-bar-chart',group:'ADMINISTRACIÓN & RECEPCIÓN'},
    {key:'recompensas',label:'Recompensas y promociones',icon:'bi-gift',group:'GESTIÓN COMERCIAL & BENEFICIOS'},
    {key:'mi-pandita',label:'Mi pandita (Socio)',icon:'bi-stars',group:'EXPERIENCIA DEL SOCIO (VISTA)'},
    {key:'asistencias',label:'Asistencias (Socio)',icon:'bi-calendar-check',group:'EXPERIENCIA DEL SOCIO (VISTA)'},
    {key:'mi-membresia',label:'Mi membresía',icon:'bi-person-vcard',group:'EXPERIENCIA DEL SOCIO (VISTA)'},
    {key:'configuracion',label:'Configuración Empresa',icon:'bi-gear',group:'CONFIGURACIÓN DEL SISTEMA'},
    {key:'usuarios',label:'Usuarios y roles',icon:'bi-person-lock',group:'CONFIGURACIÓN DEL SISTEMA'},
];
const KEYS = MODULES.map(m=>m.key);
const CLIENT = ['inicio','aforo','recompensas','mi-pandita','asistencias','mi-membresia'];
let ready;
async function init() {
    if (ready) return ready;
    ready = (async () => {
        await db.execute(`CREATE TABLE IF NOT EXISTS role_access (
            rol_id INT PRIMARY KEY, etiqueta VARCHAR(80) NOT NULL, descripcion VARCHAR(255) NOT NULL DEFAULT '',
            permisos JSON NOT NULL, actualizado TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (rol_id) REFERENCES roles(id) ON DELETE CASCADE
        )`);

        await require('./staffMemberLink').init();
        const defaultRoles = [
            {
                nombre: 'recepcion',
                etiqueta: 'Recepción / Counter',
                descripcion: 'Control de accesos, check-in, registro de socios, clientes diarios y canje de premios.',
                permisos: ['inicio', 'check-in', 'socios', 'invitados', 'aforo', 'recompensas'],
            },
            {
                nombre: 'entrenador',
                etiqueta: 'Entrenador / Trainer',
                descripcion: 'Supervisión de sala, aforo en tiempo real, asistencias y acompañamiento.',
                permisos: ['inicio', 'check-in', 'aforo', 'recompensas'],
            },
        ];

        for (const dr of defaultRoles) {
            try {
                const [existing] = await db.execute('SELECT id FROM roles WHERE nombre=?', [dr.nombre]);
                let roleId;
                if (!existing[0]) {
                    const [ins] = await db.execute('INSERT INTO roles (nombre) VALUES (?)', [dr.nombre]);
                    roleId = ins.insertId;
                } else {
                    roleId = existing[0].id;
                }
                await db.execute(
                    `INSERT INTO role_access (rol_id, etiqueta, descripcion, permisos) VALUES (?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE etiqueta=VALUES(etiqueta), descripcion=VALUES(descripcion)`,
                    [roleId, dr.etiqueta, dr.descripcion, JSON.stringify(dr.permisos)]
                );
            } catch (err) {
                // Ignore duplicate or mock db limitations during testing
            }
        }
    })().catch((e) => { ready = null; throw e; });
    return ready;
}
function parse(value) {
    try { const parsed=typeof value==='string'?JSON.parse(value):value; return Array.isArray(parsed)?[...new Set(parsed.filter(p=>KEYS.includes(p)))]:[]; }
    catch { return []; }
}
function permissions(role, value) { return role==='admin'?[...KEYS]:role==='cliente'?[...CLIENT]:parse(value); }
async function identity(id) {
    await init();
    const [rows]=await db.execute(`SELECT u.id,r.nombre AS rol,a.etiqueta,a.permisos,
        m.id AS memberId,m.dni AS memberDni,m.nombre AS memberNombre,m.apellido AS memberApellido,m.activo AS memberActivo
        FROM usuarios u JOIN roles r ON r.id=u.rol_id LEFT JOIN role_access a ON a.rol_id=r.id
        LEFT JOIN staff_member_links l ON l.staff_user_id=u.id LEFT JOIN usuarios m ON m.id=l.member_user_id
        WHERE u.id=? AND u.activo=1`,[id]);
    if(!rows[0])return null;
    const row=rows[0];
    return {id:row.id,rol:row.rol,roleLabel:row.etiqueta || (row.rol==='admin'?'Administrador':row.rol==='cliente'?'Cliente':row.rol),permissions:permissions(row.rol,row.permisos),memberLink:require('./staffMemberLink').fromRow(row)};
}
async function decorate(user) { const access=await identity(user.id);if(!access)throw new Error('Usuario no disponible');return {...user,...access}; }
function requestModules(req) {
    const path=(req.originalUrl || '').split('?')[0];
    if(path.startsWith('/api/auth/'))return [];
    if(path.startsWith('/api/admin/usuarios'))return ['usuarios'];
    if(path.startsWith('/api/admin/dashboard'))return ['inicio'];
    if(path.startsWith('/api/admin/checkin'))return ['check-in'];
    if(path.startsWith('/api/admin/socios'))return ['socios'];
    if(path.startsWith('/api/admin/planes'))return ['socios'];
    if(path.startsWith('/api/dni'))return ['socios','check-in'];
    if(path.startsWith('/api/admin/dispositivos')){
        if(path.includes('/register/') || path.endsWith('/simulate/register') || /\/dispositivos\/\d+\/status$/.test(path))return ['socios'];
        if(path.endsWith('/remote-session/create')&&req.body?.action==='register')return ['socios'];
        return ['check-in','socios'];
    }
    if(path.startsWith('/api/invitados'))return ['invitados'];
    if(path.startsWith('/api/configuracion'))return ['configuracion'];
    if(path.startsWith('/api/recompensas'))return ['recompensas'];
    if(path.startsWith('/api/membresias/admin'))return ['socios'];
    if(path.startsWith('/api/membresias'))return ['mi-membresia','asistencias','inicio'];
    if(path.includes('/asistencias/activos'))return ['check-in','inicio'];
    if(path.includes('/asistencias/buscar'))return ['check-in','socios'];
    if(path.includes('/asistencias/canjear-recompensa'))return ['recompensas'];
    if(path.includes('/asistencias/mi-objetivo'))return ['asistencias'];
    if(path.includes('/asistencias/'))return ['asistencias','mi-pandita','recompensas','inicio'];
    if(path.startsWith('/api/aforo'))return ['aforo','inicio'];
    return null; // Unknown staff endpoints fail closed.
}
function canRequest(auth,req) {
    if(auth.rol==='admin'||auth.rol==='cliente')return true;
    if(auth.memberLink && require('./staffMemberLink').personalRequest(req))return true;
    const required=requestModules(req);
    return Array.isArray(required) && (!required.length || required.some(key=>auth.permissions?.includes(key)));
}
function mayGrant(actor, role, granted) {
    if(actor.rol==='admin')return role!=='cliente';
    return !['admin','cliente'].includes(role) && granted.every(key=>actor.permissions?.includes(key));
}
module.exports={MODULES,KEYS,init,parse,permissions,identity,decorate,requestModules,canRequest,mayGrant};
