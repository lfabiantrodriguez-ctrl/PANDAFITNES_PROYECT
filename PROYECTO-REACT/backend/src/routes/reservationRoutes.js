const express = require("express");
const ReservationController = require("../controllers/ReservationController");
const { authenticateToken, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/dashboard", authenticateToken, ReservationController.getReservationDashboard);
router.get("/socio", authenticateToken, requireRole("admin"), ReservationController.getSocioReservations);
router.get("/", authenticateToken, requireRole("cliente"), ReservationController.getMyReservations);
router.post("/", authenticateToken, requireRole("cliente"), ReservationController.createReservation);

module.exports = router;
