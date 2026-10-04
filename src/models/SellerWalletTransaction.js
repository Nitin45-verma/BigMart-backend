const mongoose = require('mongoose');

const sellerWalletTransactionSchema = new mongoose.Schema(
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
    type: {
      type: String,
      enum: [
        'ORDER_EARNING',
        'PLATFORM_FEE',
        'REFUND_DEBIT',
        'CANCELLATION_DEBIT',
        'PAYOUT_REQUEST',
        'PAYOUT_COMPLETED',
        'PAYOUT_FAILED',
        'PAYOUT_REVERSED',
        'ADJUSTMENT_CREDIT',
        'ADJUSTMENT_DEBIT',
        'SETTLEMENT_AVAILABLE'
      ],
      required: true
    },
    direction: {
      type: String,
      enum: ['credit', 'debit', 'transfer'],
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    balanceBefore: {
      type: Number,
      required: true
    },
    balanceAfter: {
      type: Number,
      required: true
    },
    // Earning enters as pending, then becomes available via SETTLEMENT_AVAILABLE
    balanceType: {
      type: String,
      enum: ['pending', 'available'],
      required: true
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      index: true
    },
    orderItemReference: {
      type: mongoose.Schema.Types.ObjectId
    },
    returnRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReturnRequest'
    },
    payout: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SellerPayout',
      index: true
    },
    referenceId: {
      type: String
    },
    description: {
      type: String
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed
    },
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

sellerWalletTransactionSchema.index({ seller: 1, createdAt: -1 });
sellerWalletTransactionSchema.index({ seller: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model('SellerWalletTransaction', sellerWalletTransactionSchema);
