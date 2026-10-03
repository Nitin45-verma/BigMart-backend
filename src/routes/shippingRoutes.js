const express = require('express');
const shippingController = require('../controllers/shippingController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { requireEmailVerified } = require('../middleware/verificationMiddleware');
const { validateShippingQuoteInput } = require('../validators/shippingValidator');

const router = express.Router();

// Shipping quote routes require authentication, customer role, and verified email
router.use(authenticate, authorizeRoles('customer'), requireEmailVerified);

router.post('/quote', validateShippingQuoteInput, shippingController.getShippingQuote);

module.exports = router;
