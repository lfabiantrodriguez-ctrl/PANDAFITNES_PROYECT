const express = require("express");
const AuthController = require("../controllers/AuthController");
const { authenticateToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/login", AuthController.login);
router.post("/google", AuthController.googleLogin);
router.post("/forgot-password", AuthController.forgotPassword);
router.post("/reset-password", AuthController.resetPassword);

router.get("/me", authenticateToken, AuthController.getMe);
router.put("/me", authenticateToken, AuthController.updateMe);
router.put("/me/password", authenticateToken, AuthController.changePassword);

module.exports = router;
