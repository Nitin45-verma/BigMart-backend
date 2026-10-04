const mongoose = require('mongoose');

const sellerPayoutSchema = new mongoose.Schema(
  {
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Seller',
      required: true,
      index: true
    },
    wallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SellerWallet',
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, 'Payout amount must be greater than zero']
    },
    currency: {
      type: String,
      default: 'INR'
    },
    status: {
      type: String,
      enum: ['REQUESTED', 'APPROVED', 'PROCESSING', 'COMPLETED', 'REJECTED', 'FAILED', 'CANCELLED'],
      default: 'REQUESTED',
      index: true
    },
    requestedAt: {
      type: Date,
      default: Date.now
    },
    reviewedAt: {
      type: Date
    },
    processedAt: {
      type: Date
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rejectionReason: {
      type: String
    },
    failureReason: {
      type: String
    },
    payoutProvider: {
      type: String,
      default: 'mock' // can be razorpayx, stripe, etc.
    },
    providerPayoutId: {
      type: String
    },
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true
    },
    bankAccountSnapshot: {
      accountHolderName: String,
      accountNumberMasked: String,
      ifscCode: String,
      bankName: String
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed
    }
  },
  {
    timestamps: true
  }
);

sellerPayoutSchema.index({ seller: 1, createdAt: -1 });
sellerPayoutSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('SellerPayout', sellerPayoutSchema);
