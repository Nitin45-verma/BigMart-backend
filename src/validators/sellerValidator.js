const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');

/**
 * Validates seller application submission input.
 * Blocks attempts to inject administrative or status fields.
 */
const validateSellerApplyInput = (req, res, next) => {
  const protectedFields = [
    'status',
    'reviewedBy',
    'reviewedAt',
    'rejectionReason',
    'role',
    'platformFee',
    'commission',
    'platformFeeRate',
    'commissionRate',
    'platformFeePercentage'
  ];

  for (const field of protectedFields) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      return next(new ApiError(400, `Setting field '${field}' is not allowed in seller application`));
    }
  }

  const {
    businessName,
    businessType,
    contactEmail,
    businessAddress,
    city,
    state,
    country,
    postalCode
  } = req.body;

  if (!businessName || typeof businessName !== 'string' || businessName.trim().length === 0) {
    return next(new ApiError(400, 'Business name is required'));
  }

  const validTypes = ['individual', 'small_business', 'medium_business', 'large_business', 'enterprise'];
  if (!businessType || !validTypes.includes(businessType)) {
    return next(new ApiError(400, 'Valid business type is required'));
  }

  if (contactEmail && typeof contactEmail === 'string' && contactEmail.trim().length > 0) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contactEmail.trim())) {
      return next(new ApiError(400, 'Valid contact email is required'));
    }
  }

  if (!businessAddress || typeof businessAddress !== 'string' || businessAddress.trim().length === 0) {
    return next(new ApiError(400, 'Business address is required'));
  }

  if (!city || typeof city !== 'string' || city.trim().length === 0) {
    return next(new ApiError(400, 'City is required'));
  }

  if (!state || typeof state !== 'string' || state.trim().length === 0) {
    return next(new ApiError(400, 'State is required'));
  }

  if (!postalCode || typeof postalCode !== 'string' || postalCode.trim().length === 0) {
    return next(new ApiError(400, 'Postal code is required'));
  }

  const countryValue = (country || 'India').trim();
  if (countryValue.toLowerCase() === 'india') {
    const pinRegex = /^[1-9][0-9]{5}$/;
    if (!pinRegex.test(postalCode.trim())) {
      return next(new ApiError(400, 'Invalid Indian postal code (PIN code must be 6 digits)'));
    }
  }

  next();
};

/**
 * Validates admin rejection reason input.
 */
const validateAdminRejectionInput = (req, res, next) => {
  const { rejectionReason } = req.body;
  if (!rejectionReason || typeof rejectionReason !== 'string' || rejectionReason.trim().length === 0) {
    return next(new ApiError(400, 'Rejection reason is required'));
  }
  if (rejectionReason.trim().length > 500) {
    return next(new ApiError(400, 'Rejection reason cannot exceed 500 characters'));
  }
  next();
};

/**
 * Validates application ID parameter format.
 */
const validateApplicationIdParam = (req, res, next) => {
  const { applicationId } = req.params;
  if (!applicationId || !mongoose.Types.ObjectId.isValid(applicationId)) {
    return next(new ApiError(400, 'Invalid application ID format'));
  }
  next();
};

module.exports = {
  validateSellerApplyInput,
  validateAdminRejectionInput,
  validateApplicationIdParam
};
