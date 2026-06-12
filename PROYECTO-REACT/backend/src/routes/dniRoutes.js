const express = require("express");
const DniController = require("../controllers/DniController");
const { authenticateToken, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/:dni", authenticateToken, requireRole("admin"), DniController.lookupDni);

module.exports = router;
