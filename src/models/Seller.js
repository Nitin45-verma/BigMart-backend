const mongoose = require('mongoose');

// Reusable embedded address schema
const addressSchema = new mongoose.Schema(
  {
    addressLine1: { type: String, trim: true },
    addressLine2: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    postalCode: { type: String, trim: true },
    country: { type: String, trim: true },
    latitude: { type: Number, min: [-90, 'Latitude must be between -90 and 90'], max: [90, 'Latitude must be between -90 and 90'] },
    longitude: { type: Number, min: [-180, 'Longitude must be between -180 and 180'], max: [180, 'Longitude must be between -180 and 180'] }
  },
  { _id: false }
);

// Reusable document metadata schema
const documentSchema = new mongoose.Schema(
  {
    type: { type: String, trim: true },
    fileUrl: { type: String, trim: true },
    fileId: { type: String, trim: true },
    status: { type: String, trim: true }
  },
  { _id: false }
);

// Bank details schema with sensitive fields protected
const bankDetailsSchema = new mongoose.Schema(
  {
    accountHolderName: { type: String, trim: true },
    accountNumber: { type: String, trim: true, select: false },
    ifscCode: { type: String, trim: true },
    bankName: { type: String, trim: true }
  },
  { _id: false }
);

const sellerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required for a Seller'],
      unique: true,
      index: true
    },
    businessName: {
      type: String,
      required: [true, 'Business name is required'],
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    businessType: {
      type: String,
      enum: {
        values: [
          'individual',
          'small_business',
          'medium_business',
          'large_business',
          'enterprise',
          'proprietorship',
          'partnership',
          'private_limited',
          'llp',
          'other'
        ],
        message: '{VALUE} is not a valid business type'
      }
    },
    gstNumber: {
      type: String,
      trim: true
    },
    panNumber: {
      type: String,
      trim: true
    },
    businessAddress: addressSchema,
    pickupAddress: addressSchema,
    latitude: {
      type: Number,
      min: [-90, 'Latitude must be between -90 and 90'],
      max: [90, 'Latitude must be between -90 and 90']
    },
    longitude: {
      type: Number,
      min: [-180, 'Longitude must be between -180 and 180'],
      max: [180, 'Longitude must be between -180 and 180']
    },
    documents: [documentSchema],
    bankDetails: {
      type: bankDetailsSchema,
      select: false // Sensitive bank details excluded by default
    },
    verificationStatus: {
      type: String,
      enum: {
        values: [
          'pending',
          'under_review',
          'approved',
          'rejected',
          'suspended',
          'blocked'
        ],
        message: '{VALUE} is not a valid verification status'
      },
      default: 'pending',
      index: true
    },
    sellerPlan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SellerPlan',
      index: true
    },
    platformFeeRate: {
      type: Number,
      min: [0, 'Platform fee rate cannot be negative']
    },
    commissionRate: {
      type: Number,
      min: [0, 'Commission rate cannot be negative']
    },
    rating: {
      type: Number,
      default: 0,
      min: [0, 'Rating cannot be less than 0'],
      max: [5, 'Rating cannot be greater than 5']
    },
    reviewCount: {
      type: Number,
      default: 0,
      min: [0, 'Review count cannot be negative']
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.bankDetails;
        return ret;
      }
    },
    toObject: {
      transform: (doc, ret) => {
        delete ret.bankDetails;
        return ret;
      }
    }
  }
);

sellerSchema.index({ businessType: 1, verificationStatus: 1, createdAt: -1 });
sellerSchema.index({ createdAt: -1 });

const Seller = mongoose.model('Seller', sellerSchema);

module.exports = Seller;
