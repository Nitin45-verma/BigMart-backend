const mongoose = require('mongoose');

const platformFeeConfigSchema = new mongoose.Schema(
  {
    businessType: {
      type: String,
      required: [true, 'Business type is required'],
      unique: true,
      trim: true,
      lowercase: true,
      index: true
    },
    rate: {
      type: Number,
      required: [true, 'Platform fee rate is required'],
      min: [0, 'Platform fee rate cannot be negative'],
      max: [0.5, 'Platform fee rate cannot exceed 50% (0.50)']
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

const PlatformFeeConfig = mongoose.model('PlatformFeeConfig', platformFeeConfigSchema);

module.exports = PlatformFeeConfig;
