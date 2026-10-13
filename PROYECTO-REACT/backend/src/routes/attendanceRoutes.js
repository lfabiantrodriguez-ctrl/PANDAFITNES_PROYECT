const express = require("express");
const AttendanceController = require("../controllers/AttendanceController");
const { authenticateToken, requireRole } = require("../middleware/authMiddleware");
const { requireMember } = require('../services/staffMemberLink');

const router = express.Router();

router.get("/activos", authenticateToken, requireRole("admin"), AttendanceController.getActiveClients);
router.get("/buscar", authenticateToken, requireRole("admin"), AttendanceController.searchBySocio);
router.get("/usuario", authenticateToken, requireMember, AttendanceController.getUserAttendanceSummary);

// Rutas de Asistencias y Mi Pandita para el socio/cliente
router.get("/mi-historial", authenticateToken, requireMember, AttendanceController.getMyAttendanceHistory);
router.put("/mi-objetivo", authenticateToken, requireMember, AttendanceController.updateMyGoals);
router.get("/pandita-estado", authenticateToken, requireMember, AttendanceController.getPandaStatus);
router.post("/canjear-recompensa", authenticateToken, requireMember, AttendanceController.redeemReward);

module.exports = router;
