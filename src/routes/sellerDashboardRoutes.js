const express = require('express');
const sellerDashboardController = require('../controllers/sellerDashboardController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeSeller } = require('../middleware/sellerMiddleware');
const {
  validateSellerProfileUpdate,
  validateSellerOrderQuery,
  validateOrderIdParam
} = require('../validators/sellerDashboardValidator');

const router = express.Router();

// Require authentication and approved seller role for all dashboard routes
router.use(authenticate, authorizeSeller);

/**
 * @route GET /api/v1/seller/dashboard/profile
 * @desc  Get safe seller business profile
 * @access Authenticated Approved Seller
 */
router.get('/profile', sellerDashboardController.getProfile);

/**
 * @route PATCH /api/v1/seller/dashboard/profile
 * @desc  Update seller business fields
 * @access Authenticated Approved Seller
 */
router.patch('/profile', validateSellerProfileUpdate, sellerDashboardController.updateProfile);

/**
 * @route GET /api/v1/seller/dashboard/summary
 * @desc  Get product counts & sales metrics summary
 * @access Authenticated Approved Seller
 */
router.get('/summary', sellerDashboardController.getSummary);

/**
 * @route GET /api/v1/seller/dashboard/orders
 * @desc  Get recent orders containing seller items
 * @access Authenticated Approved Seller
 */
router.get('/orders', validateSellerOrderQuery, sellerDashboardController.getOrders);

/**
 * @route GET /api/v1/seller/dashboard/orders/:orderId
 * @desc  Get single order details containing seller items
 * @access Authenticated Approved Seller
 */
router.get('/orders/:orderId', validateOrderIdParam, sellerDashboardController.getOrderById);

/**
 * @route GET /api/v1/seller/dashboard/products
 * @desc  Get seller product catalog with filters
 * @access Authenticated Approved Seller
 */
router.get('/products', sellerDashboardController.getProducts);

/**
 * @route GET /api/v1/seller/dashboard/sales
 * @desc  Get sales aggregated by date period
 * @access Authenticated Approved Seller
 */
router.get('/sales', sellerDashboardController.getSalesSummary);

module.exports = router;
