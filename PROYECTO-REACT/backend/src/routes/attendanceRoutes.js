const express = require("express");
const AttendanceController = require("../controllers/AttendanceController");
const { authenticateToken, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/activos", authenticateToken, requireRole("admin"), AttendanceController.getActiveClients);
router.get("/buscar", authenticateToken, requireRole("admin"), AttendanceController.searchBySocio);
router.get("/usuario", authenticateToken, requireRole("cliente"), AttendanceController.getUserAttendanceSummary);

// Rutas de Asistencias y Mi Pandita para el socio/cliente
router.get("/mi-historial", authenticateToken, AttendanceController.getMyAttendanceHistory);
router.put("/mi-objetivo", authenticateToken, AttendanceController.updateMyGoals);
router.get("/pandita-estado", authenticateToken, AttendanceController.getPandaStatus);
router.post("/canjear-recompensa", authenticateToken, AttendanceController.redeemReward);

module.exports = router;
