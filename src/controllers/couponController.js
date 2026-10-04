const couponService = require('../services/couponService');

const validateCoupon = async (req, res, next) => {
  try {
    const { code } = req.body;
    const result = await couponService.validateCouponForCustomer(req.user.userId, code);
    
    res.status(200).json({
      success: true,
      data: {
        code: result.coupon.code,
        discountType: result.coupon.discountType,
        discountAmount: result.discountAmount,
        eligibleSubtotal: result.eligibleSubtotal,
        message: 'Coupon applied successfully'
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  validateCoupon
};
