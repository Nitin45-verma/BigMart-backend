const express = require('express');
const adminAnalyticsController = require('../controllers/adminAnalyticsController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(authenticate, authorizeRoles('admin'));

router.get('/sales', adminAnalyticsController.getSalesAnalytics);

module.exports = router;
