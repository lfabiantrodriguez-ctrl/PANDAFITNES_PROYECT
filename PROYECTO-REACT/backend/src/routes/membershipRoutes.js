const express = require("express");
const MembershipController = require("../controllers/MembershipController");
const { authenticateToken, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/mi-membresia", authenticateToken, MembershipController.getMyMembership);
router.get("/mis-pagos", authenticateToken, MembershipController.getMyPayments);
router.get("/admin/membresias", authenticateToken, requireRole("admin"), MembershipController.getMembershipsList);
router.post("/admin/renovar", authenticateToken, requireRole("admin"), MembershipController.renewMembership);

module.exports = router;
