const express = require("express");
const CheckInController = require("../controllers/CheckInController");
const { authenticateToken, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/lookup/:code", authenticateToken, requireRole("admin"), CheckInController.lookupReservation);
router.post("/confirm", authenticateToken, requireRole("admin"), CheckInController.confirmEntry);
router.post("/finalize", authenticateToken, requireRole("admin"), CheckInController.finalizeReservation);

module.exports = router;
