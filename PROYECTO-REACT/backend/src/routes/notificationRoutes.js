const express = require("express");
const NotificationController = require("../controllers/NotificationController");
const { authenticateToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", authenticateToken, NotificationController.getMyNotifications);
router.put("/leer-todas", authenticateToken, NotificationController.markAllAsRead);
router.put("/:id/leer", authenticateToken, NotificationController.markAsRead);

module.exports = router;
