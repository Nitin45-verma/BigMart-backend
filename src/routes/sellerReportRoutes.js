const express = require('express');
const sellerAnalyticsController = require('../controllers/sellerAnalyticsController');
const { validateAnalyticsQuery } = require('../validators/analyticsValidator');
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(authenticate, authorizeRoles('seller'), validateAnalyticsQuery);

router.get('/sales', sellerAnalyticsController.getSalesReport);
router.get('/orders', sellerAnalyticsController.getOrdersReport);
router.get('/products', sellerAnalyticsController.getProductsReport);
router.get('/payouts', sellerAnalyticsController.getPayoutsReport);

module.exports = router;
