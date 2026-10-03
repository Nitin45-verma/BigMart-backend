const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');

/**
 * Validates ObjectId parameter format.
 */
const validateObjectId = (id, fieldName = 'ID') => {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, `Invalid ${fieldName} format`);
  }
};

const validateUserIdParam = (req, res, next) => {
  try {
    validateObjectId(req.params.userId, 'User ID');
    next();
  } catch (err) {
    next(err);
  }
};

const validateSellerIdParam = (req, res, next) => {
  try {
    validateObjectId(req.params.sellerId, 'Seller ID');
    next();
  } catch (err) {
    next(err);
  }
};

const validateProductIdParam = (req, res, next) => {
  try {
    validateObjectId(req.params.productId, 'Product ID');
    next();
  } catch (err) {
    next(err);
  }
};

const validateOrderIdParam = (req, res, next) => {
  try {
    validateObjectId(req.params.orderId, 'Order ID');
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Validates user role modification payload.
 */
const validateUserRoleInput = (req, res, next) => {
  const { role } = req.body;
  const validRoles = ['customer', 'seller', 'admin'];

  if (!role || !validRoles.includes(role)) {
    return next(new ApiError(400, `Valid role is required. Allowed values: ${validRoles.join(', ')}`));
  }

  // Reject unauthorized privilege field injections
  const forbiddenFields = ['isEmailVerified', 'password', 'passwordHash', 'googleId', 'isBlocked'];
  for (const field of forbiddenFields) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      return next(new ApiError(400, `Field '${field}' cannot be modified through this endpoint`));
    }
  }

  next();
};

/**
 * Validates platform fee configuration update payload.
 */
const validatePlatformFeeInput = (req, res, next) => {
  const { businessType, rate } = req.body;
  const validTypes = [
    'individual',
    'small_business',
    'medium_business',
    'large_business',
    'enterprise',
    'proprietorship',
    'partnership',
    'private_limited',
    'llp',
    'other'
  ];

  if (!businessType || !validTypes.includes(String(businessType).toLowerCase())) {
    return next(new ApiError(400, `Valid business type is required. Allowed: ${validTypes.join(', ')}`));
  }

  if (rate === undefined || rate === null || isNaN(Number(rate))) {
    return next(new ApiError(400, 'Valid platform fee rate is required'));
  }

  const numRate = Number(rate);
  const normalizedRate = numRate > 1 ? numRate / 100 : numRate;

  if (normalizedRate < 0 || normalizedRate > 0.5) {
    return next(new ApiError(400, 'Platform fee rate must be between 0% (0) and 50% (0.50)'));
  }

  next();
};

/**
 * Validates order status update payload.
 */
const validateOrderStatusInput = (req, res, next) => {
  const { orderStatus } = req.body;
  const validStatuses = ['pending_payment', 'paid', 'processing', 'shipped', 'out_of_delivery', 'delivered', 'cancelled'];

  if (!orderStatus || !validStatuses.includes(orderStatus)) {
    return next(new ApiError(400, `Valid orderStatus is required. Allowed: ${validStatuses.join(', ')}`));
  }

  // Ensure no financial fields injected
  const forbiddenFinancials = ['subtotal', 'gstTotal', 'grandTotal', 'deliveryFee', 'items', 'payment'];
  for (const field of forbiddenFinancials) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      return next(new ApiError(400, `Field '${field}' cannot be modified through order status endpoint`));
    }
  }

  next();
};

module.exports = {
  validateUserIdParam,
  validateSellerIdParam,
  validateProductIdParam,
  validateOrderIdParam,
  validateUserRoleInput,
  validatePlatformFeeInput,
  validateOrderStatusInput
};
