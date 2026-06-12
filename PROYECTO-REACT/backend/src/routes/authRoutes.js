const express = require("express");
const AuthController = require("../controllers/AuthController");
const { authenticateToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/login", AuthController.login);
router.get("/me", authenticateToken, AuthController.getMe);

module.exports = router;
