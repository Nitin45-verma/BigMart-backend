const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');

/**
 * List of forbidden fields that customers/clients MUST NOT inject.
 */
const FORBIDDEN_CLIENT_FIELDS = [
  'customer',
  'seller',
  'orderItemId',
  'isVerifiedPurchase',
  'status',
  'reportedCount',
  'sellerReply',
  'sellerReplyAt',
  'adminNote',
  'ratingAverage',
  'ratingCount',
  'ratingBreakdown'
];

/**
 * Validates MongoDB ObjectId format.
 */
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

/**
 * Ensures payload does not contain forbidden security/admin fields.
 */
const checkForbiddenFields = (body) => {
  if (!body || typeof body !== 'object') return;
  for (const field of FORBIDDEN_CLIENT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      throw new ApiError(400, `Setting '${field}' is not allowed`);
    }
  }
};

/**
 * Validates payload for creating a product review.
 */
const validateCreateReview = (data) => {
  checkForbiddenFields(data);

  const { rating, comment, title } = data;

  if (rating === undefined || rating === null) {
    throw new ApiError(400, 'Rating is required');
  }

  if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ApiError(400, 'Rating must be an integer between 1 and 5');
  }

  if (!comment || typeof comment !== 'string' || !comment.trim()) {
    throw new ApiError(400, 'Review comment is required');
  }

  const trimmedComment = comment.trim();
  if (trimmedComment.length < 3) {
    throw new ApiError(400, 'Review comment must be at least 3 characters long');
  }
  if (trimmedComment.length > 2000) {
    throw new ApiError(400, 'Review comment cannot exceed 2000 characters');
  }

  if (title !== undefined && title !== null) {
    if (typeof title !== 'string') {
      throw new ApiError(400, 'Title must be a string');
    }
    if (title.trim().length > 200) {
      throw new ApiError(400, 'Title cannot exceed 200 characters');
    }
  }

  if (data.orderId && !isValidObjectId(data.orderId)) {
    throw new ApiError(400, 'Invalid orderId format');
  }
};

/**
 * Validates payload for updating a product review.
 */
const validateUpdateReview = (data) => {
  checkForbiddenFields(data);

  const { rating, comment, title } = data;

  if (rating !== undefined && rating !== null) {
    if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new ApiError(400, 'Rating must be an integer between 1 and 5');
    }
  }

  if (comment !== undefined && comment !== null) {
    if (typeof comment !== 'string' || !comment.trim()) {
      throw new ApiError(400, 'Review comment cannot be empty');
    }
    const trimmedComment = comment.trim();
    if (trimmedComment.length < 3) {
      throw new ApiError(400, 'Review comment must be at least 3 characters long');
    }
    if (trimmedComment.length > 2000) {
      throw new ApiError(400, 'Review comment cannot exceed 2000 characters');
    }
  }

  if (title !== undefined && title !== null) {
    if (typeof title !== 'string') {
      throw new ApiError(400, 'Title must be a string');
    }
    if (title.trim().length > 200) {
      throw new ApiError(400, 'Title cannot exceed 200 characters');
    }
  }
};

/**
 * Validates seller reply payload.
 */
const validateSellerReply = (data) => {
  const reply = data.reply || data.sellerReply;
  if (!reply || typeof reply !== 'string' || !reply.trim()) {
    throw new ApiError(400, 'Reply text is required');
  }
  if (reply.trim().length > 1000) {
    throw new ApiError(400, 'Seller reply cannot exceed 1000 characters');
  }
};

/**
 * Validates admin status moderation payload.
 */
const validateAdminStatus = (data) => {
  const { status } = data;
  if (!status || !['published', 'pending', 'hidden', 'rejected'].includes(status)) {
    throw new ApiError(400, 'Valid status (published, pending, hidden, rejected) is required');
  }
};

/**
 * Validates review report payload.
 */
const validateReportReview = (data) => {
  const { reason, description } = data;
  const validReasons = ['spam', 'abusive', 'offensive', 'fake', 'irrelevant', 'other'];

  if (!reason || !validReasons.includes(reason)) {
    throw new ApiError(400, `Reason must be one of: ${validReasons.join(', ')}`);
  }

  if (description !== undefined && description !== null) {
    if (typeof description !== 'string') {
      throw new ApiError(400, 'Description must be a string');
    }
    if (description.trim().length > 1000) {
      throw new ApiError(400, 'Description cannot exceed 1000 characters');
    }
  }
};

module.exports = {
  isValidObjectId,
  checkForbiddenFields,
  validateCreateReview,
  validateUpdateReview,
  validateSellerReply,
  validateAdminStatus,
  validateReportReview
};
