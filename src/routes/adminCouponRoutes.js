const express = require('express');
const adminCouponController = require('../controllers/adminCouponController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const {
  validateCreateCoupon,
  validateUpdateCoupon,
  validateCouponStatus,
  validateCouponIdParam
} = require('../validators/couponValidator');

const router = express.Router();

router.use(authenticate, authorizeRoles('admin'));

router.post('/', validateCreateCoupon, adminCouponController.createCoupon);
router.get('/', adminCouponController.getCoupons);
router.get('/:couponId', validateCouponIdParam, adminCouponController.getCoupon);
router.patch('/:couponId', validateCouponIdParam, validateUpdateCoupon, adminCouponController.updateCoupon);
router.patch('/:couponId/status', validateCouponIdParam, validateCouponStatus, adminCouponController.updateStatus);
router.delete('/:couponId', validateCouponIdParam, adminCouponController.deleteCoupon);

module.exports = router;
