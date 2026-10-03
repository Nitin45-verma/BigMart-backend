const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');

/**
 * Validates PATCH /api/v1/seller/dashboard/profile input.
 * Protects administrative, role, fee, and identity fields.
 */
const validateSellerProfileUpdate = (req, res, next) => {
  const protectedFields = [
    '_id',
    'user',
    'role',
    'sellerId',
    'verificationStatus',
    'platformFeeRate',
    'commissionRate',
    'commission',
    'reviewedBy',
    'reviewedAt',
    'rating',
    'reviewCount',
    'sellerPlan',
    'documents',
    'bankDetails',
    'approvalStatus'
  ];

  for (const field of protectedFields) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      return next(new ApiError(400, `Modifying field '${field}' is not permitted`));
    }
  }

  const {
    businessName,
    description,
    businessAddress,
    pickupAddress,
    latitude,
    longitude
  } = req.body;

  if (businessName !== undefined) {
    if (typeof businessName !== 'string' || businessName.trim().length === 0) {
      return next(new ApiError(400, 'Business name cannot be empty'));
    }
    if (businessName.trim().length > 100) {
      return next(new ApiError(400, 'Business name cannot exceed 100 characters'));
    }
  }

  if (description !== undefined && description !== null) {
    if (typeof description === 'string' && description.trim().length > 1000) {
      return next(new ApiError(400, 'Description cannot exceed 1000 characters'));
    }
  }

  const validateCoords = (lat, lng) => {
    if (lat !== undefined && lat !== null) {
      const numLat = Number(lat);
      if (isNaN(numLat) || numLat < -90 || numLat > 90) {
        throw new ApiError(400, 'Latitude must be a valid number between -90 and 90');
      }
    }
    if (lng !== undefined && lng !== null) {
      const numLng = Number(lng);
      if (isNaN(numLng) || numLng < -180 || numLng > 180) {
        throw new ApiError(400, 'Longitude must be a valid number between -180 and 180');
      }
    }
  };

  try {
    validateCoords(latitude, longitude);

    if (businessAddress && typeof businessAddress === 'object') {
      validateCoords(businessAddress.latitude, businessAddress.longitude);
    }

    if (pickupAddress && typeof pickupAddress === 'object') {
      validateCoords(pickupAddress.latitude, pickupAddress.longitude);
    }
  } catch (err) {
    return next(err);
  }

  next();
};

/**
 * Validates order list query parameters.
 */
const validateSellerOrderQuery = (req, res, next) => {
  const { page, limit, from, to } = req.query;

  if (page !== undefined) {
    const pageNum = parseInt(page, 10);
    if (isNaN(pageNum) || pageNum < 1) {
      return next(new ApiError(400, 'Page parameter must be a positive integer'));
    }
  }

  if (limit !== undefined) {
    const limitNum = parseInt(limit, 10);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return next(new ApiError(400, 'Limit parameter must be an integer between 1 and 100'));
    }
  }

  if (from !== undefined) {
    const fromDate = new Date(from);
    if (isNaN(fromDate.getTime())) {
      return next(new ApiError(400, 'Invalid from date format'));
    }
  }

  if (to !== undefined) {
    const toDate = new Date(to);
    if (isNaN(toDate.getTime())) {
      return next(new ApiError(400, 'Invalid to date format'));
    }
  }

  next();
};

/**
 * Validates orderId URL parameter.
 */
const validateOrderIdParam = (req, res, next) => {
  const { orderId } = req.params;
  if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
    return next(new ApiError(400, 'Invalid order ID format'));
  }
  next();
};

module.exports = {
  validateSellerProfileUpdate,
  validateSellerOrderQuery,
  validateOrderIdParam
};
