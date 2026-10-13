const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../utils/helpers");

async function authenticateToken(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
        return res.status(401).json({ message: "Token requerido" });
    }

    let claims;
    try { claims = jwt.verify(token, JWT_SECRET); }
    catch {
        return res.status(401).json({ message: "Token invalido" });
    }
    try {
        const access=require('../services/roleAccess');
        req.auth=await access.identity(claims.id);
        if(!req.auth)return res.status(401).json({message:'Usuario desactivado o no disponible'});
        if(!access.canRequest(req.auth,req))return res.status(403).json({message:'Tu rol no tiene acceso a esta ventana.'});
        return next();
    } catch(error) { console.error('Error consultando permisos:',error.message);return res.status(503).json({message:'No se pudieron verificar tus permisos.'}); }
}

function verifyToken(req, res, next) {
    return authenticateToken(req, res, next);
}

function requireRole(roleOrRoles) {
    const roles = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles];

    return (req, res, next) => {
        const customStaff=req.auth && !['admin','cliente'].includes(req.auth.rol);
        const permittedStaff=roles.includes('admin') && customStaff && require('../services/roleAccess').canRequest(req.auth,req);
        if (!roles.includes(req.auth?.rol) && !permittedStaff) {
            return res.status(403).json({ message: "No tiene permisos para esta accion" });
        }

        return next();
    };
}

function requirePermission(key) {
    return (req,res,next)=>{
        if(req.auth?.rol!=='cliente' && (req.auth?.rol==='admin'||req.auth?.permissions?.includes(key)))return next();
        return res.status(403).json({message:'No tienes permiso para administrar usuarios y roles.'});
    };
}

module.exports = {
    authenticateToken,
    verifyToken,
    requireRole,
    requirePermission,
};
