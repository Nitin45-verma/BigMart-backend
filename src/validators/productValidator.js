const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');

/**
 * Validates product creation and update inputs.
 * Blocks attempts to inject protected fields like seller, platformFee, commission, or admin approval fields.
 */
const validateProductInput = (req, res, next) => {
  const protectedFields = [
    'seller',
    'createdBy',
    'platformFee',
    'commission',
    'isApproved',
    'approvalStatus',
    'internalFee',
    'platformFeeRate',
    'commissionRate',
    'platformFeePercentage'
  ];

  for (const field of protectedFields) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      return next(new ApiError(400, `Setting field '${field}' is not allowed in product payload`));
    }
  }

  const {
    category,
    subCategory,
    name,
    sku,
    price,
    compareAtPrice,
    costPrice,
    gstRate,
    stock,
    lowStockThreshold,
    weight,
    status
  } = req.body;

  if (req.method === 'POST') {
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return next(new ApiError(400, 'Product name is required'));
    }

    if (!category || !mongoose.Types.ObjectId.isValid(category)) {
      return next(new ApiError(400, 'Valid category ID is required'));
    }

    if (!sku || typeof sku !== 'string' || sku.trim().length === 0) {
      return next(new ApiError(400, 'Product SKU is required'));
    }

    if (price === undefined || typeof price !== 'number' || price < 0) {
      return next(new ApiError(400, 'Valid non-negative selling price is required'));
    }

    if (gstRate === undefined || typeof gstRate !== 'number' || gstRate < 0 || gstRate > 100) {
      return next(new ApiError(400, 'GST rate must be a percentage between 0 and 100'));
    }

    if (stock === undefined || typeof stock !== 'number' || stock < 0) {
      return next(new ApiError(400, 'Stock count must be a non-negative number'));
    }
  } else if (req.method === 'PATCH') {
    if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
      return next(new ApiError(400, 'Product name cannot be empty'));
    }

    if (category !== undefined && (!category || !mongoose.Types.ObjectId.isValid(category))) {
      return next(new ApiError(400, 'Valid category ID is required'));
    }

    if (sku !== undefined && (typeof sku !== 'string' || sku.trim().length === 0)) {
      return next(new ApiError(400, 'Product SKU cannot be empty'));
    }

    if (price !== undefined && (typeof price !== 'number' || price < 0)) {
      return next(new ApiError(400, 'Price must be a non-negative number'));
    }

    if (gstRate !== undefined && (typeof gstRate !== 'number' || gstRate < 0 || gstRate > 100)) {
      return next(new ApiError(400, 'GST rate must be a percentage between 0 and 100'));
    }

    if (stock !== undefined && (typeof stock !== 'number' || stock < 0)) {
      return next(new ApiError(400, 'Stock must be a non-negative number'));
    }
  }

  if (subCategory && !mongoose.Types.ObjectId.isValid(subCategory)) {
    return next(new ApiError(400, 'Invalid subCategory ID format'));
  }

  if (compareAtPrice !== undefined && (typeof compareAtPrice !== 'number' || compareAtPrice < 0)) {
    return next(new ApiError(400, 'compareAtPrice must be a non-negative number'));
  }

  if (costPrice !== undefined && (typeof costPrice !== 'number' || costPrice < 0)) {
    return next(new ApiError(400, 'costPrice must be a non-negative number'));
  }

  if (lowStockThreshold !== undefined && (typeof lowStockThreshold !== 'number' || lowStockThreshold < 0)) {
    return next(new ApiError(400, 'lowStockThreshold must be a non-negative number'));
  }

  if (weight !== undefined && (typeof weight !== 'number' || weight < 0)) {
    return next(new ApiError(400, 'weight must be a non-negative number'));
  }

  const validStatuses = ['draft', 'active', 'inactive', 'out_of_stock', 'archived'];
  if (status && !validStatuses.includes(status)) {
    return next(new ApiError(400, `Invalid status value. Must be one of: ${validStatuses.join(', ')}`));
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
  validateProductInput,
  validateProductIdParam
};
