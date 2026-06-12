const express = require("express");
const PlanController = require("../controllers/PlanController");
const { authenticateToken, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", authenticateToken, requireRole("admin"), PlanController.getPlanes);

module.exports = router;
