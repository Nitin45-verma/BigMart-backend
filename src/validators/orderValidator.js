const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');

/**
 * Validates order checkout payload.
 * Blocks attempts to inject client financial calculations or order status override.
 */
const validateCheckoutInput = (req, res, next) => {
  const protectedFields = [
    'subtotal',
    'gstTotal',
    'deliveryFee',
    'platformFee',
    'discount',
    'grandTotal',
    'price',
    'unitPrice',
    'seller',
    'items',
    'orderStatus',
    'payment',
    'orderNumber'
  ];

  for (const field of protectedFields) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      return next(new ApiError(400, `Setting field '${field}' is not allowed in checkout payload`));
    }
  }

  const { addressId } = req.body;

  if (!addressId || !mongoose.Types.ObjectId.isValid(addressId)) {
    return next(new ApiError(400, 'Valid shipping address ID is required'));
  }

  next();
};

/**
 * Validates Razorpay payment verification payload.
 */
const validatePaymentVerifyInput = (req, res, next) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!razorpay_order_id || typeof razorpay_order_id !== 'string' || razorpay_order_id.trim().length === 0) {
    return next(new ApiError(400, 'razorpay_order_id is required'));
  }

  if (!razorpay_payment_id || typeof razorpay_payment_id !== 'string' || razorpay_payment_id.trim().length === 0) {
    return next(new ApiError(400, 'razorpay_payment_id is required'));
  }

  if (!razorpay_signature || typeof razorpay_signature !== 'string' || razorpay_signature.trim().length === 0) {
    return next(new ApiError(400, 'razorpay_signature is required'));
  }

  next();
};

/**
 * Validates Order ID parameter format.
 */
const validateOrderIdParam = (req, res, next) => {
  const { orderId } = req.params;
  if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
    return next(new ApiError(400, 'Invalid order ID format'));
  }
  next();
};

/**
 * Validates Order Cancellation request input.
 * Rejects client manipulation of order/payment status or financial fields.
 */
const validateCancelOrderInput = (req, res, next) => {
  const protectedFields = [
    'paymentStatus',
    'orderStatus',
    'refundStatus',
    'refundAmount',
    'cancelledAt',
    'cancelledBy',
    'approvedBy',
    'sellerId',
    'platformFee',
    'commission',
    'shippingFee',
    'subtotal',
    'grandTotal'
  ];

  for (const field of protectedFields) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      return next(new ApiError(400, `Modifying field '${field}' is strictly prohibited`));
    }
  }

  const { reason } = req.body;

  if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
    return next(new ApiError(400, 'Cancellation reason is required'));
  }

  if (reason.trim().length > 500) {
    return next(new ApiError(400, 'Cancellation reason cannot exceed 500 characters'));
  }

  next();
};

module.exports = {
  validateCheckoutInput,
  validatePaymentVerifyInput,
  validateOrderIdParam,
  validateCancelOrderInput
};

