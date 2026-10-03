const express = require('express');
const notificationController = require('../controllers/notificationController');
const { authenticate } = require('../middleware/authMiddleware');
const { requireEmailVerified } = require('../middleware/verificationMiddleware');
const {
  validateGetNotificationsQuery,
  validateNotificationIdParam
} = require('../validators/notificationValidator');

const router = express.Router();

// All notification routes require authentication and verified email
router.use(authenticate, requireEmailVerified);

// GET /api/v1/notifications — paginated list (owned by authenticated user)
router.get('/', validateGetNotificationsQuery, notificationController.getNotifications);

// GET /api/v1/notifications/unread-count — count unread
// Note: this route MUST be registered before /:notificationId to avoid param collision
router.get('/unread-count', notificationController.getUnreadCount);

// PATCH /api/v1/notifications/read-all — mark all as read
router.patch('/read-all', notificationController.markAllNotificationsRead);

// GET /api/v1/notifications/:notificationId — single notification (ownership enforced)
router.get('/:notificationId', validateNotificationIdParam, notificationController.getNotificationById);

// PATCH /api/v1/notifications/:notificationId/read — mark single as read
router.patch('/:notificationId/read', validateNotificationIdParam, notificationController.markNotificationRead);

module.exports = router;
