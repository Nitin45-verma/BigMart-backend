const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');

/**
 * Validates GET /notifications query parameters.
 * Enforces safe pagination bounds and controlled filter values.
 */
const validateGetNotificationsQuery = (req, res, next) => {
  const { page, limit, isRead, type } = req.query;

  // Validate page
  if (page !== undefined) {
    const pageNum = parseInt(page, 10);
    if (isNaN(pageNum) || pageNum < 1) {
      return next(new ApiError(400, 'page must be a positive integer'));
    }
  }

  // Validate limit (max 50)
  if (limit !== undefined) {
    const limitNum = parseInt(limit, 10);
    if (isNaN(limitNum) || limitNum < 1) {
      return next(new ApiError(400, 'limit must be a positive integer'));
    }
    if (limitNum > 50) {
      return next(new ApiError(400, 'limit cannot exceed 50'));
    }
  }

  // Validate isRead boolean filter
  if (isRead !== undefined) {
    if (isRead !== 'true' && isRead !== 'false') {
      return next(new ApiError(400, "isRead must be 'true' or 'false'"));
    }
  }

  // Validate notification type filter
  if (type !== undefined) {
    const { NOTIFICATION_TYPES } = require('../models/Notification');
    if (!NOTIFICATION_TYPES.includes(type)) {
      return next(
        new ApiError(400, `type must be one of: ${NOTIFICATION_TYPES.join(', ')}`)
      );
    }
  }

  next();
};

/**
 * Validates :notificationId route parameter is a valid MongoDB ObjectId.
 */
const validateNotificationIdParam = (req, res, next) => {
  const { notificationId } = req.params;
  if (!notificationId || !mongoose.Types.ObjectId.isValid(notificationId)) {
    return next(new ApiError(400, 'Invalid notification ID format'));
  }
  next();
};

module.exports = {
  validateGetNotificationsQuery,
  validateNotificationIdParam
};
