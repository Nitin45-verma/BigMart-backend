const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');

/**
 * Validates category creation and update inputs.
 */
const validateCategoryInput = (req, res, next) => {
  const { name, parentCategory, sortOrder, isActive } = req.body;

  if (req.method === 'POST') {
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return next(new ApiError(400, 'Category name is required'));
    }
  } else if (req.method === 'PATCH') {
    if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
      return next(new ApiError(400, 'Category name cannot be empty'));
    }
  }

  if (parentCategory) {
    if (!mongoose.Types.ObjectId.isValid(parentCategory)) {
      return next(new ApiError(400, 'Invalid parent category ID format'));
    }
  }

  if (sortOrder !== undefined && typeof sortOrder !== 'number') {
    return next(new ApiError(400, 'Sort order must be a number'));
  }

  if (isActive !== undefined && typeof isActive !== 'boolean') {
    return next(new ApiError(400, 'isActive must be a boolean'));
  }

  next();
};

/**
 * Validates category ID parameter format.
 */
const validateCategoryIdParam = (req, res, next) => {
  const { categoryId } = req.params;
  if (!categoryId || !mongoose.Types.ObjectId.isValid(categoryId)) {
    return next(new ApiError(400, 'Invalid category ID format'));
  }
  next();
};

module.exports = {
  validateCategoryInput,
  validateCategoryIdParam
};
