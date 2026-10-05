const express = require('express');
const adminAnalyticsController = require('../controllers/adminAnalyticsController');
const { validateAnalyticsQuery } = require('../validators/analyticsValidator');
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(authenticate, authorizeRoles('admin'), validateAnalyticsQuery);

// API routes
router.get('/overview', adminAnalyticsController.getOverview);
router.get('/sales-trend', adminAnalyticsController.getSalesTrend);
router.get('/sales', adminAnalyticsController.getSalesAnalytics);
router.get('/orders', adminAnalyticsController.getOrders);
router.get('/sellers', adminAnalyticsController.getSellers);
router.get('/products', adminAnalyticsController.getProducts);
router.get('/categories', adminAnalyticsController.getCategories);
router.get('/customers', adminAnalyticsController.getCustomers);
router.get('/top-products', adminAnalyticsController.getTopProducts);
router.get('/inventory', adminAnalyticsController.getInventory);
router.get('/returns', adminAnalyticsController.getReturns);
router.get('/cancellations', adminAnalyticsController.getCancellations);
router.get('/payouts', adminAnalyticsController.getPayouts);
router.get('/platform-fees', adminAnalyticsController.getPlatformFees);
router.get('/support', adminAnalyticsController.getSupport);

module.exports = router;
