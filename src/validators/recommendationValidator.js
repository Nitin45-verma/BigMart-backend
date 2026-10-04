const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');

const validateRecommendationQuery = (req, res, next) => {
  const { limit, page, ...unknownQuery } = req.query;

  // Reject arbitrary fields
  const allowedKeys = ['limit', 'page'];
  const queryKeys = Object.keys(req.query);
  for (const key of queryKeys) {
    if (!allowedKeys.includes(key)) {
      return next(new ApiError(400, `Unknown query parameter: ${key}`));
    }
    // Prevent Mongo operator injections (keys starting with $) or raw objects
    if (key.startsWith('$') || typeof req.query[key] === 'object') {
      return next(new ApiError(400, 'Invalid query parameter format'));
    }
  }

  if (page !== undefined) {
    const parsed = Number(page);
    if (!Number.isInteger(parsed) || parsed < 1) return next(new ApiError(400, 'page must be a positive integer'));
  }

  if (limit !== undefined) {
    const parsed = Number(limit);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) return next(new ApiError(400, 'limit must be a positive integer between 1 and 50'));
  }

  next();
};

const validateProductIdParam = (req, res, next) => {
  const { productId } = req.params;
  if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
    return next(new ApiError(400, 'Invalid product ID format'));
  }
  next();
};

const validateCategorySlugParam = (req, res, next) => {
  const { categorySlug } = req.params;
  if (!categorySlug || typeof categorySlug !== 'string' || categorySlug.trim().length === 0) {
    return next(new ApiError(400, 'Invalid category slug'));
  }
  next();
};

const validateSellerIdParam = (req, res, next) => {
  const { sellerId } = req.params;
  if (!sellerId || !mongoose.Types.ObjectId.isValid(sellerId)) {
    return next(new ApiError(400, 'Invalid seller ID format'));
  }
  next();
};

module.exports = {
  validateRecommendationQuery,
  validateProductIdParam,
  validateCategorySlugParam,
  validateSellerIdParam
};
