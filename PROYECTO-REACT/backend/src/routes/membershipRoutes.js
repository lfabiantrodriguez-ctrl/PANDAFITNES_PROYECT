const express = require("express");
const MembershipController = require("../controllers/MembershipController");
const { authenticateToken, requireRole } = require("../middleware/authMiddleware");
const { requireMember } = require('../services/staffMemberLink');

const router = express.Router();

router.get("/mi-membresia", authenticateToken, requireMember, MembershipController.getMyMembership);
router.get("/mis-pagos", authenticateToken, requireMember, MembershipController.getMyPayments);
router.get("/admin/membresias", authenticateToken, requireRole("admin"), MembershipController.getMembershipsList);
router.post("/admin/renovar", authenticateToken, requireRole("admin"), MembershipController.renewMembership);

module.exports = router;
