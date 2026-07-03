const express = require("express");
const AttendanceController = require("../controllers/AttendanceController");
const { authenticateToken, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/activos", authenticateToken, requireRole("admin"), AttendanceController.getActiveClients);
router.get("/usuario", authenticateToken, requireRole("cliente"), AttendanceController.getUserAttendanceSummary);

module.exports = router;
