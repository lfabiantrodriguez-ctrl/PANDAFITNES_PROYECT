const db = require('../config/database');
let ready;
function init() {
    if (!ready) ready = db.execute(`CREATE TABLE IF NOT EXISTS staff_member_links (
        staff_user_id INT PRIMARY KEY, member_user_id INT NOT NULL UNIQUE,
        linked_by INT NOT NULL, linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (staff_user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        FOREIGN KEY (member_user_id) REFERENCES usuarios(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).catch(error => { ready = null; throw error; });
    return ready;
}
function fromRow(row) {
    return row.memberId ? { id:Number(row.memberId), dni:row.memberDni, nombre:row.memberNombre,
        apellido:row.memberApellido, activo:Boolean(row.memberActivo), sameAccount:Number(row.memberId)===Number(row.id) } : null;
}
function canManage(actor) {
    return actor?.rol==='admin' || (actor?.rol!=='cliente' && actor?.permissions?.includes('usuarios') && actor.permissions.includes('socios'));
}
async function getMemberId(auth) {
    if (auth.rol==='cliente') return Number(auth.id);
    const [rows] = await db.execute(`SELECT m.id,m.activo,r.nombre AS rol
        FROM staff_member_links l JOIN usuarios m ON m.id=l.member_user_id JOIN roles r ON r.id=m.rol_id
        WHERE l.staff_user_id=?`,[auth.id]);
    const member=rows[0];
    if (!member || (member.rol!=='cliente' && Number(member.id)!==Number(auth.id))) {
        const error=new Error('Vincula un perfil de socio desde Usuarios y roles para comenzar tu entrenamiento.');
        error.status=409;error.code='MEMBER_NOT_LINKED';throw error;
    }
    if (!member.activo) {
        const error=new Error('La cuenta del socio vinculado está desactivada. Consulta con administración.');
        error.status=409;error.code='MEMBER_INACTIVE';throw error;
    }
    return Number(member.id);
}
async function requireMember(req,res,next) {
    try { req.memberId=await getMemberId(req.auth);return next(); }
    catch(error) { return res.status(error.status||503).json({message:error.status?error.message:'No se pudo consultar tu perfil de socio.',code:error.status?error.code:'MEMBER_UNAVAILABLE'}); }
}
const PERSONAL_REQUESTS = {
    GET:['/api/asistencias/usuario','/api/asistencias/mi-historial','/api/asistencias/pandita-estado',
        '/api/membresias/mi-membresia','/api/membresias/mis-pagos',
        '/api/recompensas/catalogo','/api/recompensas/convenios','/api/recompensas/mis-canjes'],
    PUT:['/api/asistencias/mi-objetivo'],POST:['/api/asistencias/canjear-recompensa'],
};
function personalRequest(req) {
    const url=(req.originalUrl||'').split('?')[0].replace(/\/$/,'');
    return Boolean(PERSONAL_REQUESTS[req.method||'GET']?.includes(url));
}
async function candidates(staffId) {
    const [rows]=await db.execute(`SELECT u.id,u.dni,u.nombre,u.apellido,u.activo,l.staff_user_id AS linkedStaffId
        FROM usuarios u JOIN roles r ON r.id=u.rol_id LEFT JOIN staff_member_links l ON l.member_user_id=u.id
        WHERE r.nombre='cliente' AND (l.staff_user_id IS NULL OR l.staff_user_id=?) ORDER BY u.apellido,u.nombre`,[staffId]);
    return rows;
}
async function save(actor,staffId,memberId) {
    if (!canManage(actor)) { const error=new Error('Necesitas acceso a Usuarios y roles y Gestión de socios para gestionar la vinculación.');error.status=403;throw error; }
    if (!Number.isSafeInteger(staffId)||staffId<1||!(memberId===null||(Number.isSafeInteger(memberId)&&memberId>0))) throw new Error('Selecciona un usuario y un socio válidos.');
    const connection=await db.getConnection();
    try {
        await connection.beginTransaction();
        const [staffRows]=await connection.execute(`SELECT u.id,u.activo,r.nombre AS rol FROM usuarios u JOIN roles r ON r.id=u.rol_id WHERE u.id=? FOR UPDATE`,[staffId]);
        const staff=staffRows[0];
        if (!staff || staff.rol==='cliente') throw new Error('Selecciona una cuenta del personal.');
        if (staff.rol==='admin'&&actor.rol!=='admin') { const error=new Error('Solo un administrador puede vincular su cuenta de socio.');error.status=403;throw error; }
        if (memberId===null) {
            await connection.execute('DELETE FROM staff_member_links WHERE staff_user_id=?',[staffId]);
        } else {
            const member=memberId===staffId?staff:(await connection.execute(`SELECT u.id,u.activo,r.nombre AS rol FROM usuarios u JOIN roles r ON r.id=u.rol_id WHERE u.id=? FOR UPDATE`,[memberId]))[0][0];
            if (!member || (memberId!==staffId&&member.rol!=='cliente')) throw new Error('Solo puedes vincular un socio o activar el perfil en la misma cuenta.');
            if (!member.activo) throw new Error('Activa la cuenta del socio antes de vincularla.');
            const [linked]=await connection.execute('SELECT staff_user_id FROM staff_member_links WHERE member_user_id=? FOR UPDATE',[memberId]);
            if (linked[0]&&Number(linked[0].staff_user_id)!==staffId) { const error=new Error('Este socio ya está vinculado a otro trabajador.');error.code='ER_DUP_ENTRY';throw error; }
            // Do not use ON DUPLICATE KEY UPDATE: a concurrent member collision must never transfer ownership.
            const [current]=await connection.execute('SELECT staff_user_id FROM staff_member_links WHERE staff_user_id=? FOR UPDATE',[staffId]);
            if (current[0]) await connection.execute('UPDATE staff_member_links SET member_user_id=?,linked_by=?,linked_at=CURRENT_TIMESTAMP WHERE staff_user_id=?',[memberId,actor.id,staffId]);
            else await connection.execute('INSERT INTO staff_member_links (staff_user_id,member_user_id,linked_by) VALUES (?,?,?)',[staffId,memberId,actor.id]);
        }
        await connection.commit();
    } catch(error) { await connection.rollback();throw error; }
    finally { connection.release(); }
}
module.exports={init,fromRow,canManage,getMemberId,requireMember,personalRequest,candidates,save};
