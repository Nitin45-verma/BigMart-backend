const mongoose = require('mongoose');

const sellerPlanSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Plan name is required'],
      trim: true
    },
    slug: {
      type: String,
      required: [true, 'Plan slug is required'],
      lowercase: true,
      trim: true,
      unique: true,
      index: true
    },
    description: {
      type: String,
      trim: true
    },
    platformFeeType: {
      type: String,
      enum: {
        values: ['percentage', 'fixed'],
        message: '{VALUE} is not a valid platform fee type'
      },
      default: 'percentage'
    },
    platformFeeRate: {
      type: Number,
      required: [true, 'Platform fee rate is required'],
      min: [0, 'Platform fee rate cannot be negative']
    },
    commissionType: {
      type: String,
      enum: {
        values: ['percentage', 'fixed'],
        message: '{VALUE} is not a valid commission type'
      },
      default: 'percentage'
    },
    commissionRate: {
      type: Number,
      required: [true, 'Commission rate is required'],
      min: [0, 'Commission rate cannot be negative']
    },
    minMonthlySales: {
      type: Number,
      default: 0,
      min: [0, 'Minimum monthly sales cannot be negative']
    },
    maxMonthlySales: {
      type: Number,
      min: [0, 'Maximum monthly sales cannot be negative']
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

const SellerPlan = mongoose.model('SellerPlan', sellerPlanSchema);

module.exports = SellerPlan;
