const express = require("express");
const PlanController = require("../controllers/PlanController");
const { authenticateToken, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", authenticateToken, requireRole("admin"), PlanController.getPlanes);
router.put("/:id", authenticateToken, requireRole("admin"), PlanController.updatePlan);

module.exports = router;
