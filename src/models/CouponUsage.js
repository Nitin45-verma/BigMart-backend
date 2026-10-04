const mongoose = require('mongoose');

const couponUsageSchema = new mongoose.Schema(
  {
    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Coupon',
      required: true,
      index: true
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      unique: true
    },
    discountAmount: {
      type: Number,
      required: true,
      min: 0
    },
    usedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

couponUsageSchema.index({ coupon: 1, customer: 1 });
couponUsageSchema.index({ coupon: 1, customer: 1, order: 1 }, { unique: true });

const CouponUsage = mongoose.model('CouponUsage', couponUsageSchema);
module.exports = CouponUsage;
