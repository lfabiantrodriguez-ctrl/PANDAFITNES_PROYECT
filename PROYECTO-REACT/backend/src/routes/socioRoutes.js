const express = require("express");
const SocioController = require("../controllers/SocioController");
const { authenticateToken, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", authenticateToken, requireRole("admin"), SocioController.getSocios);
router.post("/", authenticateToken, requireRole("admin"), SocioController.createSocio);

module.exports = router;
