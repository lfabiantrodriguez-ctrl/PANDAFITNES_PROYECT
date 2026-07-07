const express = require("express");
const GuestController = require("../controllers/GuestController");
const { verifyToken, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(verifyToken);
router.get("/", requireRole(["admin"]), GuestController.listGuests);
router.post("/", requireRole(["admin"]), GuestController.createGuest);

module.exports = router;
