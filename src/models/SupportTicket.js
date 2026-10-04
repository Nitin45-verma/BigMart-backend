const mongoose = require('mongoose');

const TICKET_CATEGORIES = [
  'ORDER', 'PRODUCT', 'PAYMENT', 'DELIVERY',
  'RETURN', 'REFUND', 'COUPON', 'PAYOUT',
  'WALLET', 'ACCOUNT', 'INVENTORY', 'OTHER'
];

const TICKET_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

const TICKET_STATUSES = [
  'OPEN', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER',
  'WAITING_FOR_SELLER', 'ESCALATED', 'RESOLVED', 'CLOSED'
];

const REQUESTER_ROLES = ['customer', 'seller', 'admin'];

/**
 * Controlled status transition map.
 * Terminal state: CLOSED — no transitions allowed.
 */
const ALLOWED_STATUS_TRANSITIONS = {
  OPEN:                   ['IN_PROGRESS'],
  IN_PROGRESS:            ['WAITING_FOR_CUSTOMER', 'WAITING_FOR_SELLER', 'ESCALATED', 'RESOLVED'],
  WAITING_FOR_CUSTOMER:   ['IN_PROGRESS'],
  WAITING_FOR_SELLER:     ['IN_PROGRESS'],
  ESCALATED:              ['IN_PROGRESS', 'RESOLVED'],
  RESOLVED:               ['CLOSED'],
  CLOSED:                 []
};

const supportTicketSchema = new mongoose.Schema(
  {
    ticketNumber: {
      type: String,
      required: [true, 'Ticket number is required'],
      unique: true,
      index: true,
      trim: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'createdBy is required'],
      index: true
    },
    requesterRole: {
      type: String,
      enum: { values: REQUESTER_ROLES, message: '{VALUE} is not a valid requester role' },
      required: [true, 'requesterRole is required']
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
      minlength: [5, 'Subject must be at least 5 characters'],
      maxlength: [200, 'Subject cannot exceed 200 characters']
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters'],
      maxlength: [5000, 'Description cannot exceed 5000 characters']
    },
    category: {
      type: String,
      enum: { values: TICKET_CATEGORIES, message: '{VALUE} is not a valid category' },
      required: [true, 'Category is required'],
      index: true
    },
    priority: {
      type: String,
      enum: { values: TICKET_PRIORITIES, message: '{VALUE} is not a valid priority' },
      default: 'MEDIUM',
      index: true
    },
    status: {
      type: String,
      enum: { values: TICKET_STATUSES, message: '{VALUE} is not a valid status' },
      default: 'OPEN',
      index: true
    },
    // Optional linked entities
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null
    },
    returnRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReturnRequest',
      default: null
    },
    payout: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SellerPayout',
      default: null
    },
    paymentReference: {
      type: String,
      trim: true,
      default: null
    },
    // Admin-only fields — never controlled by client
    assignedAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    escalated: {
      type: Boolean,
      default: false,
      index: true
    },
    escalationReason: {
      type: String,
      trim: true,
      maxlength: [1000, 'Escalation reason cannot exceed 1000 characters'],
      default: null
    },
    resolvedAt: {
      type: Date,
      default: null
    },
    closedAt: {
      type: Date,
      default: null
    },
    lastMessageAt: {
      type: Date,
      default: null,
      index: true
    },
    // Safe supplemental metadata — no secrets
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for efficient queries
supportTicketSchema.index({ createdBy: 1, status: 1, createdAt: -1 });
supportTicketSchema.index({ status: 1, priority: 1, createdAt: -1 });
supportTicketSchema.index({ category: 1, createdAt: -1 });
supportTicketSchema.index({ assignedAdmin: 1, status: 1 });
supportTicketSchema.index({ order: 1 });
supportTicketSchema.index({ createdAt: -1 });

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
module.exports.TICKET_CATEGORIES = TICKET_CATEGORIES;
module.exports.TICKET_PRIORITIES = TICKET_PRIORITIES;
module.exports.TICKET_STATUSES = TICKET_STATUSES;
module.exports.ALLOWED_STATUS_TRANSITIONS = ALLOWED_STATUS_TRANSITIONS;
