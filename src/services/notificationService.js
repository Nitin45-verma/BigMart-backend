const { Notification, NOTIFICATION_TYPES } = require('../models/Notification');
const ApiError = require('../utils/ApiError');

/**
 * SAFE_DATA_BLOCKED_KEYS: Fields that must NEVER appear in notification data payloads.
 * Protects against leaking passwords, tokens, secrets, or private credentials.
 */
const SAFE_DATA_BLOCKED_KEYS = new Set([
  'password',
  'passwordHash',
  'hash',
  'refreshToken',
  'refreshTokenHash',
  'accessToken',
  'jwt',
  'token',
  'secret',
  'razorpaySecret',
  'razorpayKeySecret',
  'key_secret',
  'keySecret',
  'bankAccount',
  'bankDetails',
  'accountNumber',
  'ifscCode',
  'cvv',
  'cardNumber',
  'emailVerificationTokenHash',
  'emailVerificationToken'
]);

/**
 * Sanitizes a data payload to strip any blocked sensitive keys (deep scan, 1 level).
 * Does not expose internal error details.
 */
const sanitizeData = (data) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data;
  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    if (SAFE_DATA_BLOCKED_KEYS.has(key)) {
      // Silently drop the blocked field
      continue;
    }
    sanitized[key] = value;
  }
  return sanitized;
};

/**
 * Core notification creation function.
 * All business event notifications must be created through this service.
 * Never trusts client-supplied recipient or type values.
 *
 * @param {Object} params
 * @param {string|ObjectId} params.recipient - User._id of the notification recipient (server-derived only)
 * @param {string} params.recipientRole - 'customer' | 'seller' | 'admin'
 * @param {string} params.type - Must be a controlled NOTIFICATION_TYPES value
 * @param {string} params.title - Notification title
 * @param {string} params.message - Notification body message
 * @param {string|ObjectId} [params.order] - Optional Order reference
 * @param {string|ObjectId} [params.returnRequest] - Optional ReturnRequest reference
 * @param {Object} [params.data] - Safe supplemental data (sanitized before save)
 * @param {string} [params.eventKey] - Idempotency key to prevent duplicate notifications
 * @returns {Promise<Object>} Created Notification document or null if duplicate suppressed
 */
const createNotification = async ({
  recipient,
  recipientRole,
  type,
  title,
  message,
  order = null,
  returnRequest = null,
  data = null,
  eventKey = null
}) => {
  try {
    if (!recipient) {
      console.warn('[NotificationService] createNotification called with no recipient — skipped');
      return null;
    }

    if (!NOTIFICATION_TYPES.includes(type)) {
      console.warn(`[NotificationService] Invalid notification type '${type}' — skipped`);
      return null;
    }

    const safeData = data ? sanitizeData(data) : null;

    const doc = await Notification.create({
      recipient,
      recipientRole,
      type,
      title,
      message,
      order,
      returnRequest,
      data: safeData,
      eventKey: eventKey || null
    });

    return doc;
  } catch (error) {
    // Duplicate eventKey: unique index violation — silently ignore (idempotency)
    if (error.code === 11000) {
      console.log(`[NotificationService] Duplicate notification suppressed (eventKey: ${eventKey})`);
      return null;
    }
    // Log but do not rethrow — notification failure must not break business operations
    console.error(`[NotificationService] Failed to create notification (type: ${type}): ${error.message}`);
    return null;
  }
};

/**
 * Create notifications for multiple recipients in parallel.
 * Individual failures do not affect other recipients.
 */
const createNotificationBatch = async (notificationPayloads) => {
  const results = await Promise.allSettled(
    notificationPayloads.map((payload) => createNotification(payload))
  );
  return results;
};

// ============================================================
// ORDER EVENT NOTIFICATIONS
// ============================================================

/**
 * Notify customer on ORDER_PLACED.
 * Notify each seller in the order on SELLER_ORDER_RECEIVED.
 */
const notifyOrderPlaced = async ({ order, userId, sellerUserIds }) => {
  const payloads = [];

  // Customer notification
  payloads.push({
    recipient: userId,
    recipientRole: 'customer',
    type: 'ORDER_PLACED',
    title: 'Order Placed Successfully',
    message: `Your order #${order.orderNumber} has been placed. Total: ₹${order.grandTotal}`,
    order: order._id,
    data: {
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      grandTotal: order.grandTotal,
      orderStatus: order.orderStatus
    },
    eventKey: `ORDER_PLACED:${order._id}:${userId}`
  });

  // Per-seller notifications (multi-vendor isolation)
  if (sellerUserIds && sellerUserIds.length > 0) {
    for (const sellerInfo of sellerUserIds) {
      // Only show seller their own item count/summary — not other sellers' data
      payloads.push({
        recipient: sellerInfo.userId,
        recipientRole: 'seller',
        type: 'SELLER_ORDER_RECEIVED',
        title: 'New Order Received',
        message: `A new order #${order.orderNumber} has been placed with ${sellerInfo.itemCount} item(s) from your store.`,
        order: order._id,
        data: {
          orderId: order._id.toString(),
          orderNumber: order.orderNumber,
          itemCount: sellerInfo.itemCount,
          sellerSubtotal: sellerInfo.sellerSubtotal
        },
        eventKey: `SELLER_ORDER_RECEIVED:${order._id}:${sellerInfo.userId}`
      });
    }
  }

  await createNotificationBatch(payloads);
};

/**
 * Notify customer on PAYMENT_SUCCESS.
 */
const notifyPaymentSuccess = async ({ order, userId }) => {
  await createNotification({
    recipient: userId,
    recipientRole: 'customer',
    type: 'PAYMENT_SUCCESS',
    title: 'Payment Successful',
    message: `Payment of ₹${order.grandTotal} for order #${order.orderNumber} was successful.`,
    order: order._id,
    data: {
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      grandTotal: order.grandTotal,
      paymentStatus: order.payment?.status
    },
    eventKey: `PAYMENT_SUCCESS:${order._id}:${userId}`
  });
};

/**
 * Notify customer on PAYMENT_FAILED.
 */
const notifyPaymentFailed = async ({ order, userId }) => {
  await createNotification({
    recipient: userId,
    recipientRole: 'customer',
    type: 'PAYMENT_FAILED',
    title: 'Payment Failed',
    message: `Payment for order #${order.orderNumber} failed. Please retry or contact support.`,
    order: order._id,
    data: {
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      paymentStatus: order.payment?.status
    },
    eventKey: `PAYMENT_FAILED:${order._id}:${userId}`
  });
};

/**
 * Notify customer on ORDER_CANCELLED.
 */
const notifyOrderCancelled = async ({ order, userId }) => {
  await createNotification({
    recipient: userId,
    recipientRole: 'customer',
    type: 'ORDER_CANCELLED',
    title: 'Order Cancelled',
    message: `Your order #${order.orderNumber} has been cancelled.`,
    order: order._id,
    data: {
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus
    },
    eventKey: `ORDER_CANCELLED:${order._id}:${userId}`
  });
};

// ============================================================
// RETURN / REFUND EVENT NOTIFICATIONS
// ============================================================

/**
 * Notify customer on RETURN_REQUESTED.
 * Notify seller on SELLER_RETURN_REQUESTED.
 * Notify admin on ADMIN_RETURN_REQUESTED.
 */
const notifyReturnRequested = async ({
  returnRequest,
  customerUserId,
  sellerUserId,
  adminUserIds,
  orderNumber
}) => {
  const payloads = [];

  // Customer notification
  payloads.push({
    recipient: customerUserId,
    recipientRole: 'customer',
    type: 'RETURN_REQUESTED',
    title: 'Return Request Submitted',
    message: `Your return request for order #${orderNumber} has been submitted and is under review.`,
    order: returnRequest.order,
    returnRequest: returnRequest._id,
    data: {
      returnRequestId: returnRequest._id.toString(),
      status: returnRequest.status,
      refundAmount: returnRequest.refundAmount
    },
    eventKey: `RETURN_REQUESTED:${returnRequest._id}:${customerUserId}`
  });

  // Seller notification (only their own return data)
  if (sellerUserId) {
    payloads.push({
      recipient: sellerUserId,
      recipientRole: 'seller',
      type: 'SELLER_RETURN_REQUESTED',
      title: 'New Return Request',
      message: `A customer has submitted a return request for order #${orderNumber}. Please review it in your seller dashboard.`,
      order: returnRequest.order,
      returnRequest: returnRequest._id,
      data: {
        returnRequestId: returnRequest._id.toString(),
        reason: returnRequest.reason,
        status: returnRequest.status
      },
      eventKey: `SELLER_RETURN_REQUESTED:${returnRequest._id}:${sellerUserId}`
    });
  }

  // Admin notification(s)
  if (adminUserIds && adminUserIds.length > 0) {
    for (const adminUserId of adminUserIds) {
      payloads.push({
        recipient: adminUserId,
        recipientRole: 'admin',
        type: 'ADMIN_RETURN_REQUESTED',
        title: 'Return Request Requires Review',
        message: `A new return request for order #${orderNumber} has been submitted and may require admin review.`,
        order: returnRequest.order,
        returnRequest: returnRequest._id,
        data: {
          returnRequestId: returnRequest._id.toString(),
          status: returnRequest.status
        },
        eventKey: `ADMIN_RETURN_REQUESTED:${returnRequest._id}:${adminUserId}`
      });
    }
  }

  await createNotificationBatch(payloads);
};

/**
 * Notify customer on RETURN_APPROVED.
 */
const notifyReturnApproved = async ({ returnRequest, customerUserId, orderNumber }) => {
  await createNotification({
    recipient: customerUserId,
    recipientRole: 'customer',
    type: 'RETURN_APPROVED',
    title: 'Return Request Approved',
    message: `Your return request for order #${orderNumber} has been approved. Refund of ₹${returnRequest.refundAmount} will be initiated.`,
    order: returnRequest.order,
    returnRequest: returnRequest._id,
    data: {
      returnRequestId: returnRequest._id.toString(),
      status: returnRequest.status,
      refundAmount: returnRequest.refundAmount
    },
    eventKey: `RETURN_APPROVED:${returnRequest._id}:${customerUserId}`
  });
};

/**
 * Notify customer on RETURN_REJECTED.
 */
const notifyReturnRejected = async ({ returnRequest, customerUserId, orderNumber }) => {
  await createNotification({
    recipient: customerUserId,
    recipientRole: 'customer',
    type: 'RETURN_REJECTED',
    title: 'Return Request Rejected',
    message: `Your return request for order #${orderNumber} has been reviewed and could not be approved.`,
    order: returnRequest.order,
    returnRequest: returnRequest._id,
    data: {
      returnRequestId: returnRequest._id.toString(),
      status: returnRequest.status,
      rejectionReason: returnRequest.rejectionReason
    },
    eventKey: `RETURN_REJECTED:${returnRequest._id}:${customerUserId}`
  });
};

/**
 * Notify customer on REFUND_INITIATED.
 */
const notifyRefundInitiated = async ({ returnRequest, customerUserId, orderNumber }) => {
  await createNotification({
    recipient: customerUserId,
    recipientRole: 'customer',
    type: 'REFUND_INITIATED',
    title: 'Refund Initiated',
    message: `Your refund of ₹${returnRequest.refundAmount} for order #${orderNumber} is being processed.`,
    order: returnRequest.order,
    returnRequest: returnRequest._id,
    data: {
      returnRequestId: returnRequest._id.toString(),
      refundAmount: returnRequest.refundAmount,
      refundStatus: returnRequest.refundStatus
    },
    eventKey: `REFUND_INITIATED:${returnRequest._id}:${customerUserId}`
  });
};

/**
 * Notify customer on REFUND_COMPLETED.
 */
const notifyRefundCompleted = async ({ returnRequest, customerUserId, orderNumber }) => {
  await createNotification({
    recipient: customerUserId,
    recipientRole: 'customer',
    type: 'REFUND_COMPLETED',
    title: 'Refund Completed',
    message: `Your refund of ₹${returnRequest.refundAmount} for order #${orderNumber} has been successfully processed.`,
    order: returnRequest.order,
    returnRequest: returnRequest._id,
    data: {
      returnRequestId: returnRequest._id.toString(),
      refundAmount: returnRequest.refundAmount,
      refundStatus: returnRequest.refundStatus,
      razorpayRefundId: returnRequest.razorpayRefundId || null
    },
    eventKey: `REFUND_COMPLETED:${returnRequest._id}:${customerUserId}`
  });
};

// ============================================================
// NOTIFICATION RETRIEVAL (READ OPERATIONS)
// ============================================================

/**
 * Get paginated notifications for authenticated user.
 * Ownership is enforced: only returns notifications where recipient === userId.
 */
const getNotifications = async (userId, { page = 1, limit = 20, isRead, type }) => {
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
  const skip = (pageNum - 1) * limitNum;

  const query = { recipient: userId };
  if (isRead !== undefined) {
    query.isRead = isRead === 'true' || isRead === true;
  }
  if (type) {
    query.type = type;
  }

  const [notifications, total] = await Promise.all([
    Notification.find(query)
      .select('-__v -eventKey')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum),
    Notification.countDocuments(query)
  ]);

  return {
    notifications,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum)
    }
  };
};

/**
 * Get unread notification count for authenticated user.
 */
const getUnreadCount = async (userId) => {
  const unreadCount = await Notification.countDocuments({
    recipient: userId,
    isRead: false
  });
  return { unreadCount };
};

/**
 * Get single notification by ID (ownership enforced).
 */
const getNotificationById = async (userId, notificationId) => {
  const notification = await Notification.findOne({
    _id: notificationId,
    recipient: userId
  }).select('-__v -eventKey');

  if (!notification) {
    throw new ApiError(404, 'Notification not found or access denied');
  }

  return notification;
};

/**
 * Mark single notification as read (ownership enforced, idempotent).
 */
const markNotificationRead = async (userId, notificationId) => {
  const notification = await Notification.findOne({
    _id: notificationId,
    recipient: userId
  });

  if (!notification) {
    throw new ApiError(404, 'Notification not found or access denied');
  }

  if (!notification.isRead) {
    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();
  }

  return notification;
};

/**
 * Notifies customer when order is shipped.
 */
const notifyOrderShipped = async ({ order, userId }) => {
  if (!order || !userId) return null;
  const eventKey = `ORDER_SHIPPED:${order._id}:${userId}`;
  return createNotification({
    recipient: userId,
    recipientRole: 'customer',
    type: 'ORDER_SHIPPED',
    title: 'Your Order Has Been Shipped',
    message: `Great news! Your order #${order.orderNumber} is on its way.`,
    order: order._id,
    eventKey
  });
};

/**
 * Notifies customer when order is delivered.
 */
const notifyOrderDelivered = async ({ order, userId }) => {
  if (!order || !userId) return null;
  const eventKey = `ORDER_DELIVERED:${order._id}:${userId}`;
  return createNotification({
    recipient: userId,
    recipientRole: 'customer',
    type: 'ORDER_DELIVERED',
    title: 'Order Delivered',
    message: `Your order #${order.orderNumber} has been delivered. Thank you for shopping with us!`,
    order: order._id,
    eventKey
  });
};

/**
 * Mark all notifications as read for the authenticated user.
 * Only updates current user's notifications — never touches other users' notifications.
 */
const markAllNotificationsRead = async (userId) => {
  const result = await Notification.updateMany(
    { recipient: userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );

  return {
    updatedCount: result.modifiedCount
  };
};

module.exports = {
  NOTIFICATION_TYPES,
  createNotification,
  createNotificationBatch,
  sanitizeData,
  // Order events
  notifyOrderPlaced,
  notifyPaymentSuccess,
  notifyPaymentFailed,
  notifyOrderCancelled,
  notifyOrderShipped,
  notifyOrderDelivered,
  // Return/refund events
  notifyReturnRequested,
  notifyReturnApproved,
  notifyReturnRejected,
  notifyRefundInitiated,
  notifyRefundCompleted,
  // Retrieval
  getNotifications,
  getUnreadCount,
  getNotificationById,
  markNotificationRead,
  markAllNotificationsRead
};
