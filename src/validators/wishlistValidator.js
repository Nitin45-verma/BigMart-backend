const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');

/**
 * Validates add to wishlist request payload.
 * Blocks attempts to inject protected fields.
 */
const validateAddToWishlistInput = (req, res, next) => {
  const protectedFields = [
    'price',
    'seller',
    'customer',
    'user',
    'status',
    'addedAt',
    'stock'
  ];

  for (const field of protectedFields) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      return next(new ApiError(400, `Setting field '${field}' is not allowed`));
    }
  }

  const { productId } = req.body;

  if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
    return next(new ApiError(400, 'Valid product ID is required'));
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

/**
 * Validates pagination parameters.
 */
const validatePaginationParams = (req, res, next) => {
  let { page, limit } = req.query;

  if (page !== undefined) {
    page = Number(page);
    if (!Number.isInteger(page) || page < 1) {
      return next(new ApiError(400, 'Page must be a positive integer'));
    }
  }

  if (limit !== undefined) {
    limit = Number(limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return next(new ApiError(400, 'Limit must be a positive integer between 1 and 100'));
    }
  }

  next();
};

module.exports = {
  validateAddToWishlistInput,
  validateProductIdParam,
  validatePaginationParams
};
