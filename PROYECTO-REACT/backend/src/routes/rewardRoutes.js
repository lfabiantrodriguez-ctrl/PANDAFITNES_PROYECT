const express = require("express");
const RewardController = require("../controllers/RewardController");
const { authenticateToken, requireRole } = require("../middleware/authMiddleware");
const { requireMember } = require('../services/staffMemberLink');

const router = express.Router();

// Rutas de catálogo de recompensas (solo admin puede crear/editar/eliminar)
router.get("/catalogo", authenticateToken, RewardController.getRewards);
router.post("/catalogo", authenticateToken, requireRole("admin", { strict: true }), RewardController.createReward);
router.put("/catalogo/:id", authenticateToken, requireRole("admin", { strict: true }), RewardController.updateReward);
router.delete("/catalogo/:id", authenticateToken, requireRole("admin", { strict: true }), RewardController.deleteReward);

// Rutas de convenios comerciales (solo admin puede crear/eliminar)
router.get("/convenios", authenticateToken, RewardController.getPartnerships);
router.post("/convenios", authenticateToken, requireRole("admin", { strict: true }), RewardController.createPartnership);
router.delete("/convenios/:id", authenticateToken, requireRole("admin", { strict: true }), RewardController.deletePartnership);

// Rutas de canjes
router.get("/mis-canjes", authenticateToken, requireMember, RewardController.getMyRedemptions);
router.get("/admin/canjes-todos", authenticateToken, requireRole("admin"), RewardController.getAllRedemptions);
router.put("/admin/canjes/:id/entregar", authenticateToken, requireRole("admin"), RewardController.deliverRedemption);

module.exports = router;
