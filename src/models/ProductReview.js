const mongoose = require('mongoose');

const reviewImageSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true },
    fileId: { type: String, trim: true },
    altText: { type: String, trim: true }
  },
  { _id: false }
);

const productReviewSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product reference is required'],
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
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order reference is required'],
      index: true
    },
    orderItemId: {
      type: String,
      required: [true, 'Order item reference is required'],
      trim: true
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
      validate: {
        validator: Number.isInteger,
        message: 'Rating must be an integer between 1 and 5'
      }
    },
    title: {
      type: String,
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters']
    },
    comment: {
      type: String,
      required: [true, 'Review comment is required'],
      trim: true,
      minlength: [3, 'Comment must be at least 3 characters'],
      maxlength: [2000, 'Comment cannot exceed 2000 characters']
    },
    images: [reviewImageSchema],
    isVerifiedPurchase: {
      type: Boolean,
      default: true
    },
    status: {
      type: String,
      enum: {
        values: ['published', 'pending', 'hidden', 'rejected'],
        message: '{VALUE} is not a valid review status'
      },
      default: 'published',
      index: true
    },
    sellerReply: {
      type: String,
      trim: true,
      default: null,
      maxlength: [1000, 'Seller reply cannot exceed 1000 characters']
    },
    sellerReplyAt: {
      type: Date,
      default: null
    },
    adminNote: {
      type: String,
      trim: true,
      default: null,
      select: false // Sensitive moderation note hidden from public queries
    },
    reportedCount: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: true
  }
);

// Unique index: One review per customer per purchased order item
productReviewSchema.index(
  { customer: 1, order: 1, orderItemId: 1, product: 1 },
  { unique: true }
);

// Compound indexes for public, seller, and customer queries
productReviewSchema.index({ product: 1, status: 1, createdAt: -1 });
productReviewSchema.index({ seller: 1, status: 1, createdAt: -1 });
productReviewSchema.index({ customer: 1, createdAt: -1 });
productReviewSchema.index({ status: 1, reportedCount: -1, createdAt: -1 });

const ProductReview = mongoose.model('ProductReview', productReviewSchema);

module.exports = ProductReview;
