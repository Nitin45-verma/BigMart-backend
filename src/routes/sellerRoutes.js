const express = require('express');
const sellerController = require('../controllers/sellerController');
const { authenticate } = require('../middleware/authMiddleware');
const { validateSellerApplyInput } = require('../validators/sellerValidator');

const router = express.Router();

// Require authentication for all customer seller application routes
router.use(authenticate);

/**
 * @route POST /api/v1/seller/apply
 * @desc  Submit seller application
 * @access Authenticated Customer (verified email)
 */
router.post('/apply', validateSellerApplyInput, sellerController.apply);

/**
 * @route GET /api/v1/seller/application
 * @desc  Get current user's seller application status
 * @access Authenticated Customer
 */
router.get('/application', sellerController.getApplication);

/**
 * @route PATCH /api/v1/seller/application/cancel
 * @desc  Cancel current user's pending seller application
 * @access Authenticated Customer
 */
router.patch('/application/cancel', sellerController.cancelApplication);

module.exports = router;
