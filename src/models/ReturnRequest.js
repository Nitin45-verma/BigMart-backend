const mongoose = require('mongoose');

const returnItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product reference is required']
    },
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true
    },
    sku: {
      type: String,
      required: [true, 'Product SKU is required'],
      trim: true
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1']
    },
    unitPrice: {
      type: Number,
      required: [true, 'Unit price is required'],
      min: [0, 'Unit price cannot be negative']
    },
    gstRate: {
      type: Number,
      default: 0,
      min: [0, 'GST rate cannot be negative']
    },
    gstAmount: {
      type: Number,
      default: 0,
      min: [0, 'GST amount cannot be negative']
    },
    itemSubtotal: {
      type: Number,
      required: [true, 'Item subtotal is required'],
      min: [0, 'Item subtotal cannot be negative']
    },
    itemTotal: {
      type: Number,
      required: [true, 'Item total is required'],
      min: [0, 'Item total cannot be negative']
    }
  },
  { _id: false }
);

const returnRequestSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order reference is required'],
      index: true
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Customer reference is required'],
      index: true
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Seller',
      required: [true, 'Seller reference is required'],
      index: true
    },
    items: {
      type: [returnItemSchema],
      validate: {
        validator: function (val) {
          return Array.isArray(val) && val.length > 0;
        },
        message: 'Return request must contain at least one item'
      }
    },
    reason: {
      type: String,
      required: [true, 'Return reason is required'],
      enum: {
        values: [
          'damaged',
          'defective',
          'wrong_item',
          'missing_item',
          'not_as_described',
          'quality_issue',
          'other'
        ],
        message: '{VALUE} is not a valid return reason'
      }
    },
    description: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      required: true,
      enum: {
        values: [
          'requested',
          'approved',
          'rejected',
          'received',
          'refund_pending',
          'refunded',
          'cancelled'
        ],
        message: '{VALUE} is not a valid return request status'
      },
      default: 'requested',
      index: true
    },
    requestedAt: {
      type: Date,
      default: Date.now
    },
    reviewedAt: {
      type: Date
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rejectionReason: {
      type: String,
      trim: true
    },
    refundAmount: {
      type: Number,
      default: 0,
      min: [0, 'Refund amount cannot be negative']
    },
    shippingRefund: {
      type: Number,
      default: 0,
      min: [0, 'Shipping refund cannot be negative']
    },
    refundStatus: {
      type: String,
      enum: ['none', 'pending', 'processed', 'failed'],
      default: 'none'
    },
    refundedAt: {
      type: Date
    },
    razorpayRefundId: {
      type: String,
      trim: true
    },
    stockRestored: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for efficient return queries and multi-seller isolation
returnRequestSchema.index({ order: 1, seller: 1 });
returnRequestSchema.index({ customer: 1, status: 1, createdAt: -1 });
returnRequestSchema.index({ seller: 1, status: 1, createdAt: -1 });
returnRequestSchema.index({ createdAt: -1 });

const ReturnRequest = mongoose.model('ReturnRequest', returnRequestSchema);

module.exports = ReturnRequest;
