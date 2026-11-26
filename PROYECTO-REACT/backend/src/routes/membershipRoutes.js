const express = require("express");
const MembershipController = require("../controllers/MembershipController");
const { authenticateToken, requireRole } = require("../middleware/authMiddleware");
const { requireMember } = require('../services/staffMemberLink');

const router = express.Router();

router.get("/mi-membresia", authenticateToken, requireMember, MembershipController.getMyMembership);
router.get("/mi-resumen", authenticateToken, requireMember, MembershipController.getMySummary);
router.get("/mis-pagos", authenticateToken, requireMember, MembershipController.getMyPayments);
router.get("/planes", authenticateToken, requireMember, MembershipController.getMemberPlanes);
router.get("/mis-ofertas", authenticateToken, requireMember, MembershipController.getMyOffers);
router.get("/mis-solicitudes", authenticateToken, requireMember, MembershipController.getMyRenewalRequests);
router.post("/validar-codigo", authenticateToken, requireMember, MembershipController.validateCoupon);
router.post("/solicitar-renovacion", authenticateToken, requireMember, MembershipController.requestRenewal);
router.post("/cancelar-solicitud", authenticateToken, requireMember, MembershipController.cancelRenewalRequest);

router.get("/admin/membresias", authenticateToken, requireRole("admin"), MembershipController.getMembershipsList);
router.post("/admin/renovar", authenticateToken, requireRole("admin"), MembershipController.renewMembership);
router.get("/admin/solicitudes", authenticateToken, requireRole("admin"), MembershipController.getAdminRenewalRequests);
router.post("/admin/solicitudes/:id/aprobar", authenticateToken, requireRole("admin"), MembershipController.approveRenewalRequest);
router.post("/admin/solicitudes/:id/rechazar", authenticateToken, requireRole("admin"), MembershipController.rejectRenewalRequest);

module.exports = router;
