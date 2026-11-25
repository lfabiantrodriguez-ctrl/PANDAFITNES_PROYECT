const express = require("express");
const ZkController = require("../controllers/ZkController");
const { authenticateToken, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

// Endpoints públicos autenticados por X-ZK-Token para agentes locales (LAN, Cable USB, Pendrive watcher, Lector USB)
router.get("/ping", ZkController.ping);
router.post("/marcaciones", ZkController.receiveMarcaciones);

// Plantillas USB: permiten acceso con X-ZK-Token (agente local) o sesión admin
function optionalAdminOrZkToken(req, res, next) {
    if (req.headers["x-zk-token"] || req.query.token) {
        return next();
    }
    return authenticateToken(req, res, () => requireRole("admin")(req, res, next));
}

router.get("/usb/huellas", optionalAdminOrZkToken, ZkController.listUsbTemplates);
router.post("/usb/huellas", optionalAdminOrZkToken, ZkController.saveUsbTemplate);

// Endpoints de gestión interna (requieren sesión de administrador / permiso en el panel)
router.get("/token", authenticateToken, requireRole("admin"), ZkController.getTokenInfo);
router.post("/token/regenerar", authenticateToken, requireRole("admin"), ZkController.regenerateToken);
router.post("/importar-archivo", authenticateToken, requireRole("admin"), ZkController.importArchivo);
router.get("/marcaciones/recientes", authenticateToken, requireRole("admin"), ZkController.getRecentMarcaciones);

module.exports = router;
