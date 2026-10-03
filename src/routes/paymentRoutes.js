const express = require('express');
const paymentController = require('../controllers/paymentController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { requireEmailVerified } = require('../middleware/verificationMiddleware');
const { validatePaymentVerifyInput } = require('../validators/orderValidator');

const router = express.Router();

// Payment verification requires authentication, customer role, and verified email
router.use(authenticate, authorizeRoles('customer'), requireEmailVerified);

router.post('/razorpay/verify', validatePaymentVerifyInput, paymentController.verifyRazorpayPayment);

module.exports = router;
