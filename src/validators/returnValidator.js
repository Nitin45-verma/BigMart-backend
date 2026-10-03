const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');

const VALID_RETURN_REASONS = [
  'damaged',
  'defective',
  'wrong_item',
  'missing_item',
  'not_as_described',
  'quality_issue',
  'other'
];

/**
 * Validates customer return request input payload.
 * Rejects any client-injected financial, price, status, or identity overrides.
 */
const validateCreateReturnInput = (req, res, next) => {
  const protectedFields = [
    'refundAmount',
    'shippingRefund',
    'sellerId',
    'seller',
    'price',
    'unitPrice',
    'gstRate',
    'gstAmount',
    'platformFee',
    'commission',
    'shippingFee',
    'status',
    'refundStatus',
    'reviewedBy',
    'reviewedAt',
    'rejectionReason',
    'stockRestored'
  ];

  for (const field of protectedFields) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      return next(new ApiError(400, `Setting protected field '${field}' is not permitted`));
    }
  }

  const { items, reason, description } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return next(new ApiError(400, 'Return request must contain an items array with at least one item'));
  }

  for (const item of items) {
    if (!item || typeof item !== 'object') {
      return next(new ApiError(400, 'Invalid return item structure'));
    }

    if (!item.product || !mongoose.Types.ObjectId.isValid(item.product)) {
      return next(new ApiError(400, 'Valid product ID is required for each return item'));
    }

    const qty = Number(item.quantity);
    if (!Number.isInteger(qty) || qty < 1) {
      return next(new ApiError(400, 'Return item quantity must be a positive integer (at least 1)'));
    }

    // Protect individual item payload fields if injected
    const itemProtectedFields = ['unitPrice', 'gstRate', 'gstAmount', 'itemSubtotal', 'itemTotal', 'price'];
    for (const f of itemProtectedFields) {
      if (Object.prototype.hasOwnProperty.call(item, f)) {
        return next(new ApiError(400, `Client-injected field '${f}' in return items is not allowed`));
      }
    }
  }

  if (!reason || typeof reason !== 'string' || !VALID_RETURN_REASONS.includes(reason)) {
    return next(
      new ApiError(
        400,
        `Return reason must be one of: ${VALID_RETURN_REASONS.join(', ')}`
      )
    );
  }

  if (reason === 'other') {
    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return next(new ApiError(400, "Description is required when return reason is 'other'"));
    }
  }

  if (description !== undefined && description !== null) {
    if (typeof description !== 'string' || description.trim().length > 1000) {
      return next(new ApiError(400, 'Description cannot exceed 1000 characters'));
    }
  }

  next();
};

/**
 * Validates Return ID parameter format.
 */
const validateReturnIdParam = (req, res, next) => {
  const { returnId } = req.params;
  if (!returnId || !mongoose.Types.ObjectId.isValid(returnId)) {
    return next(new ApiError(400, 'Invalid return ID format'));
  }
  next();
};

/**
 * Validates return rejection payload.
 */
const validateRejectReturnInput = (req, res, next) => {
  const { rejectionReason } = req.body;
  if (!rejectionReason || typeof rejectionReason !== 'string' || rejectionReason.trim().length === 0) {
    return next(new ApiError(400, 'Rejection reason is required'));
  }
  if (rejectionReason.trim().length > 500) {
    return next(new ApiError(400, 'Rejection reason cannot exceed 500 characters'));
  }
  next();
};

module.exports = {
  validateCreateReturnInput,
  validateReturnIdParam,
  validateRejectReturnInput
};
