const express = require("express");
const RewardController = require("../controllers/RewardController");
const { authenticateToken, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

// Rutas de catálogo de recompensas (público / autenticado)
router.get("/catalogo", authenticateToken, RewardController.getRewards);
router.post("/catalogo", authenticateToken, requireRole("admin"), RewardController.createReward);
router.put("/catalogo/:id", authenticateToken, requireRole("admin"), RewardController.updateReward);
router.delete("/catalogo/:id", authenticateToken, requireRole("admin"), RewardController.deleteReward);

// Rutas de convenios comerciales
router.get("/convenios", authenticateToken, RewardController.getPartnerships);
router.post("/convenios", authenticateToken, requireRole("admin"), RewardController.createPartnership);
router.delete("/convenios/:id", authenticateToken, requireRole("admin"), RewardController.deletePartnership);

// Rutas de canjes
router.get("/mis-canjes", authenticateToken, RewardController.getMyRedemptions);
router.get("/admin/canjes-todos", authenticateToken, requireRole("admin"), RewardController.getAllRedemptions);
router.put("/admin/canjes/:id/entregar", authenticateToken, requireRole("admin"), RewardController.deliverRedemption);

module.exports = router;
