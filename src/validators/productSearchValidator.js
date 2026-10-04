const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');

const validateProductSearch = (req, res, next) => {
  const {
    q,
    categorySlug,
    categoryId,
    subCategory,
    brand,
    seller,
    minPrice,
    maxPrice,
    minRating,
    maxRating,
    inStock,
    minDiscount,
    sort,
    page,
    limit,
    // explicitly reject mongo operator injections
    ...unknownQuery
  } = req.query;

  // Reject arbitrary fields
  const allowedKeys = [
    'q', 'categorySlug', 'categoryId', 'subCategory', 'brand', 'seller',
    'minPrice', 'maxPrice', 'minRating', 'maxRating', 'inStock', 'minDiscount',
    'sort', 'page', 'limit'
  ];
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

  if (q && typeof q !== 'string') return next(new ApiError(400, 'Search query must be a string'));
  if (categorySlug && typeof categorySlug !== 'string') return next(new ApiError(400, 'categorySlug must be a string'));
  if (brand && typeof brand !== 'string') return next(new ApiError(400, 'brand must be a string'));

  if (categoryId && !mongoose.Types.ObjectId.isValid(categoryId)) {
    return next(new ApiError(400, 'Invalid categoryId format'));
  }
  if (subCategory && !mongoose.Types.ObjectId.isValid(subCategory)) {
    return next(new ApiError(400, 'Invalid subCategory format'));
  }
  if (seller && !mongoose.Types.ObjectId.isValid(seller)) {
    return next(new ApiError(400, 'Invalid seller format'));
  }

  if (minPrice !== undefined) {
    const parsed = Number(minPrice);
    if (isNaN(parsed) || parsed < 0) return next(new ApiError(400, 'minPrice must be a non-negative number'));
  }
  if (maxPrice !== undefined) {
    const parsed = Number(maxPrice);
    if (isNaN(parsed) || parsed < 0) return next(new ApiError(400, 'maxPrice must be a non-negative number'));
  }
  if (minPrice !== undefined && maxPrice !== undefined && Number(minPrice) > Number(maxPrice)) {
    return next(new ApiError(400, 'minPrice cannot be greater than maxPrice'));
  }

  if (minRating !== undefined) {
    const parsed = Number(minRating);
    if (isNaN(parsed) || parsed < 0 || parsed > 5) return next(new ApiError(400, 'minRating must be between 0 and 5'));
  }
  if (maxRating !== undefined) {
    const parsed = Number(maxRating);
    if (isNaN(parsed) || parsed < 0 || parsed > 5) return next(new ApiError(400, 'maxRating must be between 0 and 5'));
  }
  if (minRating !== undefined && maxRating !== undefined && Number(minRating) > Number(maxRating)) {
    return next(new ApiError(400, 'minRating cannot be greater than maxRating'));
  }

  if (minDiscount !== undefined) {
    const parsed = Number(minDiscount);
    if (isNaN(parsed) || parsed < 0) return next(new ApiError(400, 'minDiscount must be a non-negative number'));
  }

  if (inStock !== undefined && inStock !== 'true' && inStock !== 'false') {
    return next(new ApiError(400, 'inStock must be true or false'));
  }

  const validSorts = ['relevance', 'newest', 'price_asc', 'price_desc', 'rating_desc', 'rating_asc', 'discount_desc', 'price_low_to_high', 'price_high_to_low', 'name'];
  if (sort && !validSorts.includes(sort)) {
    return next(new ApiError(400, `sort must be one of: ${validSorts.join(', ')}`));
  }

  if (page !== undefined) {
    const parsed = Number(page);
    if (!Number.isInteger(parsed) || parsed < 1) return next(new ApiError(400, 'page must be a positive integer'));
  }

  if (limit !== undefined) {
    const parsed = Number(limit);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) return next(new ApiError(400, 'limit must be a positive integer between 1 and 100'));
  }

  next();
};

module.exports = {
  validateProductSearch
};
