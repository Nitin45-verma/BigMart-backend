const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');

/**
 * Validates add to cart request payload.
 * Blocks attempts to inject price, stock, GST, or seller fields.
 */
const validateAddToCartInput = (req, res, next) => {
  const protectedFields = [
    'price',
    'seller',
    'category',
    'gst',
    'gstRate',
    'stock',
    'costPrice',
    'platformFee',
    'commission',
    'itemTotal'
  ];

  for (const field of protectedFields) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      return next(new ApiError(400, `Setting field '${field}' is not allowed in cart payload`));
    }
  }

  const { productId, quantity } = req.body;

  if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
    return next(new ApiError(400, 'Valid product ID is required'));
  }

  if (quantity !== undefined) {
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1) {
      return next(new ApiError(400, 'Quantity must be a positive integer greater than 0'));
    }
    if (quantity > 50) {
      return next(new ApiError(400, 'Quantity cannot exceed 50 items per product'));
    }
  }

  next();
};

/**
 * Validates update cart item quantity payload.
 */
const validateUpdateCartItemInput = (req, res, next) => {
  const { quantity } = req.body;

  if (quantity === undefined || typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1) {
    return next(new ApiError(400, 'Valid quantity greater than 0 is required'));
  }

  if (quantity > 50) {
    return next(new ApiError(400, 'Quantity cannot exceed 50 items per product'));
  }

  next();
};

/**
 * Validates product ID parameter format.
 */
const validateProductIdParam = (req, res, next) => {
  const { productId } = req.params;
  if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
    return next(new ApiError(400, 'Invalid product ID format'));
  }
  next();
};

module.exports = {
  validateAddToCartInput,
  validateUpdateCartItemInput,
  validateProductIdParam
};
