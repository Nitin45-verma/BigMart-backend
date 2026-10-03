const notificationService = require('../services/notificationService');

/**
 * GET /api/v1/notifications
 * Returns paginated notifications for the authenticated user (ownership enforced).
 */
const getNotifications = async (req, res, next) => {
  try {
    const { page, limit, isRead, type } = req.query;
    const result = await notificationService.getNotifications(req.user.userId, {
      page,
      limit,
      isRead,
      type
    });
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/notifications/unread-count
 * Returns the number of unread notifications for the authenticated user.
 */
const getUnreadCount = async (req, res, next) => {
  try {
    const result = await notificationService.getUnreadCount(req.user.userId);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/notifications/:notificationId
 * Returns a single notification (ownership enforced).
 */
const getNotificationById = async (req, res, next) => {
  try {
    const notification = await notificationService.getNotificationById(
      req.user.userId,
      req.params.notificationId
    );
    res.status(200).json({
      success: true,
      data: { notification }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/notifications/:notificationId/read
 * Marks a single notification as read (ownership enforced, idempotent).
 */
const markNotificationRead = async (req, res, next) => {
  try {
    const notification = await notificationService.markNotificationRead(
      req.user.userId,
      req.params.notificationId
    );
    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: { notification }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/notifications/read-all
 * Marks all of the authenticated user's notifications as read.
 * Only updates the current user's notifications — never touches other users'.
 */
const markAllNotificationsRead = async (req, res, next) => {
  try {
    const result = await notificationService.markAllNotificationsRead(req.user.userId);
    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  getNotificationById,
  markNotificationRead,
  markAllNotificationsRead
};
