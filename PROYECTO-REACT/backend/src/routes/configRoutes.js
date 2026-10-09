const express = require("express");
const ConfigController = require("../controllers/ConfigController");
const { authenticateToken, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

// GET /api/configuracion -> público para que frontend y login muestren nombre y logo actuales
router.get("/", ConfigController.getConfig);

// PUT /api/configuracion -> solo administrador
router.put("/", authenticateToken, requireRole("admin"), ConfigController.updateConfig);

module.exports = router;
