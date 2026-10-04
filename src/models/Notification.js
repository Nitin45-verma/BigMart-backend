const mongoose = require('mongoose');

/**
 * Controlled notification type enum.
 * Only server-side code can create notifications with these types.
 * Public clients cannot create notifications directly.
 */
const NOTIFICATION_TYPES = [
  // Customer events
  'ORDER_PLACED',
  'PAYMENT_SUCCESS',
  'PAYMENT_FAILED',
  'ORDER_CANCELLED',
  'ORDER_READY_TO_SHIP',
  'ORDER_SHIPPED',
  'ORDER_IN_TRANSIT',
  'ORDER_OUT_FOR_DELIVERY',
  'DELIVERY_FAILED',
  'ORDER_DELIVERED',
  'RETURN_REQUESTED',
  'RETURN_APPROVED',
  'RETURN_REJECTED',
  'REFUND_INITIATED',
  'REFUND_COMPLETED',
  // Review events
  'REVIEW_CREATED',
  'SELLER_REVIEW_RECEIVED',
  'SELLER_REPLIED_TO_REVIEW',
  'REVIEW_REPORTED',
  'REVIEW_MODERATED',
  // Seller events
  'SELLER_ORDER_RECEIVED',
  'SELLER_RETURN_REQUESTED',
  'SELLER_PAYMENT_UPDATE',
  'SELLER_LOW_STOCK',
  'SELLER_OUT_OF_STOCK',
  'PAYOUT_REQUESTED',
  'PAYOUT_APPROVED',
  'PAYOUT_REJECTED',
  'PAYOUT_PROCESSING',
  'PAYOUT_COMPLETED',
  'PAYOUT_FAILED',
  // Admin events
  'ADMIN_RETURN_REQUESTED',
  'ADMIN_NEW_SELLER_APPLICATION',
  // Support ticket events
  'SUPPORT_TICKET_CREATED',
  'SUPPORT_TICKET_REPLY',
  'SUPPORT_TICKET_ASSIGNED',
  'SUPPORT_TICKET_ESCALATED',
  'SUPPORT_TICKET_RESOLVED',
  'SUPPORT_TICKET_CLOSED',
  // System
  'SYSTEM'
];

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Notification recipient is required'],
      index: true
    },
    recipientRole: {
      type: String,
      enum: {
        values: ['customer', 'seller', 'admin'],
        message: '{VALUE} is not a valid recipient role'
      },
      required: [true, 'Recipient role is required']
    },
    type: {
      type: String,
      enum: {
        values: NOTIFICATION_TYPES,
        message: '{VALUE} is not a valid notification type'
      },
      required: [true, 'Notification type is required'],
      index: true
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters']
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
      maxlength: [1000, 'Message cannot exceed 1000 characters']
    },
    // Optional references to related business entities
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null
    },
    returnRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReturnRequest',
      default: null
    },
    review: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProductReview',
      default: null
    },
    // Safe supplemental data — must never contain secrets or credentials
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true
    },
    readAt: {
      type: Date,
      default: null
    },
    /**
     * Idempotency key prevents duplicate notifications for the same business event.
     * Format: TYPE:entityId:recipientId (e.g. ORDER_PLACED:orderId:userId)
     * Sparse + unique: allows null but enforces uniqueness when set.
     */
    eventKey: {
      type: String,
      default: null,
      sparse: true,
      unique: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for efficient notification queries
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, type: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = { Notification, NOTIFICATION_TYPES };
