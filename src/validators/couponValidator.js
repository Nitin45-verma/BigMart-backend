const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');

const validateCreateCoupon = (req, res, next) => {
  const protectedFields = [
    'usedCount',
    'createdBy',
    'updatedBy',
    'isActive'
  ];

  for (const field of protectedFields) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      return next(new ApiError(400, `Setting field '${field}' is not allowed`));
    }
  }
  
  const { code, discountType, discountValue, startDate, endDate } = req.body;
  if (!code || !discountType || !discountValue || !startDate || !endDate) {
    return next(new ApiError(400, 'Missing required fields'));
  }
  if (!['percentage', 'fixed'].includes(discountType)) {
    return next(new ApiError(400, 'Invalid discount type'));
  }
  if (discountType === 'percentage' && discountValue > 100) {
    return next(new ApiError(400, 'Percentage discount cannot exceed 100'));
  }
  if (discountValue <= 0) {
    return next(new ApiError(400, 'Discount value must be greater than 0'));
  }
  if (new Date(startDate) >= new Date(endDate)) {
    return next(new ApiError(400, 'Start date must be before end date'));
  }

  next();
};

const validateUpdateCoupon = (req, res, next) => {
  const protectedFields = [
    'usedCount',
    'createdBy',
    'updatedBy',
    'code'
  ];

  for (const field of protectedFields) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      return next(new ApiError(400, `Setting field '${field}' is not allowed`));
    }
  }

  const { discountType, discountValue, startDate, endDate } = req.body;
  
  if (discountType && !['percentage', 'fixed'].includes(discountType)) {
    return next(new ApiError(400, 'Invalid discount type'));
  }
  if (discountType === 'percentage' && discountValue > 100) {
    return next(new ApiError(400, 'Percentage discount cannot exceed 100'));
  }
  if (discountValue !== undefined && discountValue <= 0) {
    return next(new ApiError(400, 'Discount value must be greater than 0'));
  }

  if (startDate && endDate && new Date(startDate) >= new Date(endDate)) {
    return next(new ApiError(400, 'Start date must be before end date'));
  }

  next();
};

const validateCouponStatus = (req, res, next) => {
  const { isActive } = req.body;
  if (typeof isActive !== 'boolean') {
    return next(new ApiError(400, 'isActive must be a boolean'));
  }
  next();
};

const validateValidateCoupon = (req, res, next) => {
  const protectedFields = [
    'discountAmount',
    'discount',
    'finalTotal',
    'couponOwner',
    'usedCount',
    'usageLimit',
    'seller',
    'createdBy',
    'isActive',
    'status'
  ];

  for (const field of protectedFields) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      return next(new ApiError(400, `Setting field '${field}' is not allowed`));
    }
  }

  const { code } = req.body;
  if (!code || typeof code !== 'string' || code.trim() === '') {
    return next(new ApiError(400, 'Coupon code is required'));
  }
  next();
};

const validateCouponIdParam = (req, res, next) => {
  const { couponId } = req.params;
  if (!couponId || !mongoose.Types.ObjectId.isValid(couponId)) {
    return next(new ApiError(400, 'Invalid coupon ID format'));
  }
  next();
};

module.exports = {
  validateCreateCoupon,
  validateUpdateCoupon,
  validateCouponStatus,
  validateValidateCoupon,
  validateCouponIdParam
};
