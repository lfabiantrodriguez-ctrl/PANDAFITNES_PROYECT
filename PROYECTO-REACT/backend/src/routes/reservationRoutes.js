const express = require("express");
const ReservationController = require("../controllers/ReservationController");
const { authenticateToken, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", authenticateToken, requireRole("cliente"), ReservationController.getMyReservations);
router.post("/", authenticateToken, requireRole("cliente"), ReservationController.createReservation);

module.exports = router;
