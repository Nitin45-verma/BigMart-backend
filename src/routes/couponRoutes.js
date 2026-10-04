const express = require('express');
const couponController = require('../controllers/couponController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { validateValidateCoupon } = require('../validators/couponValidator');
const { requireEmailVerified } = require('../middleware/verificationMiddleware');

const router = express.Router();

router.use(authenticate, authorizeRoles('customer'), requireEmailVerified);

router.post('/validate', validateValidateCoupon, couponController.validateCoupon);

module.exports = router;
