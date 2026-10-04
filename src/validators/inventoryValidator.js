const ApiError = require('../utils/ApiError');

const validateInventoryList = (req, res, next) => {
  const { page, limit, stockStatus } = req.query;
  
  if (page && (isNaN(page) || Number(page) < 1)) {
    return next(new ApiError(400, 'Page must be a positive integer'));
  }
  if (limit && (isNaN(limit) || Number(limit) < 1 || Number(limit) > 100)) {
    return next(new ApiError(400, 'Limit must be between 1 and 100'));
  }
  if (stockStatus && !['in_stock', 'low_stock', 'out_of_stock'].includes(stockStatus)) {
    return next(new ApiError(400, 'Invalid stock status'));
  }
  
  next();
};

const validateStockIn = (req, res, next) => {
  const { quantity, reason } = req.body;
  
  if (quantity === undefined || isNaN(quantity) || Number(quantity) < 1) {
    return next(new ApiError(400, 'Quantity must be a positive integer'));
  }
  if (reason && (typeof reason !== 'string' || reason.length > 500)) {
    return next(new ApiError(400, 'Reason must be a string up to 500 characters'));
  }
  
  next();
};

const validateStockOut = (req, res, next) => {
  const { quantity, reason } = req.body;
  
  if (quantity === undefined || isNaN(quantity) || Number(quantity) < 1) {
    return next(new ApiError(400, 'Quantity must be a positive integer'));
  }
  if (reason && (typeof reason !== 'string' || reason.length > 500)) {
    return next(new ApiError(400, 'Reason must be a string up to 500 characters'));
  }
  
  next();
};

const validateAdjust = (req, res, next) => {
  const { adjustment, reason } = req.body;
  
  if (adjustment === undefined || isNaN(adjustment) || Number(adjustment) === 0) {
    return next(new ApiError(400, 'Adjustment cannot be zero'));
  }
  if (!reason || typeof reason !== 'string' || reason.trim() === '' || reason.length > 500) {
    return next(new ApiError(400, 'Reason is required for manual adjustment and must be a string up to 500 characters'));
  }
  
  next();
};

const validateThreshold = (req, res, next) => {
  const { lowStockThreshold } = req.body;
  
  if (lowStockThreshold === undefined || isNaN(lowStockThreshold) || Number(lowStockThreshold) < 0) {
    return next(new ApiError(400, 'Threshold must be a non-negative integer'));
  }
  
  next();
};

module.exports = {
  validateInventoryList,
  validateStockIn,
  validateStockOut,
  validateAdjust,
  validateThreshold
};
