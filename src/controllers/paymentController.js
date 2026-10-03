const orderService = require('../services/orderService');

/**
 * Customer: Verify Razorpay payment signature
 */
const verifyRazorpayPayment = async (req, res, next) => {
  try {
    const result = await orderService.verifyPayment(req.user.userId, req.body);
    res.status(200).json({
      success: true,
      message: result.message,
      data: { order: result.order }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  verifyRazorpayPayment
};
