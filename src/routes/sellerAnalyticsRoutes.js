const express = require('express');
const sellerAnalyticsController = require('../controllers/sellerAnalyticsController');
const { validateAnalyticsQuery } = require('../validators/analyticsValidator');
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

const router = express.Router();

// Assuming sellerMiddleware might just be authenticate and authorizeRoles('seller')
router.use(authenticate, authorizeRoles('seller'), validateAnalyticsQuery);

router.get('/overview', sellerAnalyticsController.getOverview);
router.get('/sales-trend', sellerAnalyticsController.getSalesTrend);
router.get('/products', sellerAnalyticsController.getProducts);
router.get('/top-products', sellerAnalyticsController.getTopProducts);
router.get('/inventory', sellerAnalyticsController.getInventory);
router.get('/returns', sellerAnalyticsController.getReturns);
router.get('/cancellations', sellerAnalyticsController.getCancellations);
router.get('/payouts', sellerAnalyticsController.getPayouts);

module.exports = router;
