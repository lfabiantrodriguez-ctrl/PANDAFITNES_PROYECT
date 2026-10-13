const express = require('express');
const DashboardController = require('../controllers/DashboardController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/metricas', authenticateToken, requireRole('admin'), DashboardController.getMetrics);

module.exports = router;
