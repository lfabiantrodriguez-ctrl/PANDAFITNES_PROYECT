const express = require("express");
const SocioController = require("../controllers/SocioController");
const { authenticateToken, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", authenticateToken, requireRole("admin"), SocioController.getSocios);
router.post("/", authenticateToken, requireRole("admin"), SocioController.createSocio);
router.put("/:id", authenticateToken, requireRole("admin"), SocioController.updateSocio);

// Ficha 360 y ofertas personalizadas / generales
router.get("/ofertas", authenticateToken, requireRole("admin"), SocioController.getOffers);
router.post("/ofertas", authenticateToken, requireRole("admin"), SocioController.createOffer);
router.get("/:id/ficha", authenticateToken, requireRole("admin"), SocioController.getSocioFicha);

module.exports = router;
