const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../utils/helpers");

function authenticateToken(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
        return res.status(401).json({ message: "Token requerido" });
    }

    try {
        req.auth = jwt.verify(token, JWT_SECRET);
        return next();
    } catch {
        return res.status(401).json({ message: "Token invalido" });
    }
}

function requireRole(role) {
    return (req, res, next) => {
        if (req.auth?.rol !== role) {
            return res.status(403).json({ message: "No tiene permisos para esta accion" });
        }

        return next();
    };
}

module.exports = {
    authenticateToken,
    requireRole,
};
