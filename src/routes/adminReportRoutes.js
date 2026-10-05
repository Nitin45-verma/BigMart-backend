const express = require('express');
const adminAnalyticsController = require('../controllers/adminAnalyticsController');
const { validateAnalyticsQuery } = require('../validators/analyticsValidator');
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(authenticate, authorizeRoles('admin'), validateAnalyticsQuery);

router.get('/sales', adminAnalyticsController.getSalesReport);
router.get('/orders', adminAnalyticsController.getOrdersReport);
router.get('/products', adminAnalyticsController.getProductsReport);
router.get('/sellers', adminAnalyticsController.getSellersReport);
router.get('/refunds', adminAnalyticsController.getRefundsReport);
router.get('/payouts', adminAnalyticsController.getPayoutsReport);

module.exports = router;
