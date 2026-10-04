const mongoose = require('mongoose');

const inventoryMovementSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Seller',
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: {
        values: [
          'STOCK_IN',
          'STOCK_OUT',
          'ADJUSTMENT_IN',
          'ADJUSTMENT_OUT',
          'ORDER_DEDUCTED',
          'RETURN_RESTORED',
          'ORDER_CANCEL_RESTORED',
          'ADMIN_ADJUSTMENT',
          'PRODUCT_UPDATE'
        ],
        message: '{VALUE} is not a valid movement type'
      },
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be positive']
    },
    previousStock: {
      type: Number,
      required: true,
      min: 0
    },
    newStock: {
      type: Number,
      required: true,
      min: 0
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 500
    },
    referenceType: {
      type: String,
      enum: ['Order', 'ReturnRequest', 'None'],
      default: 'None'
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

// Indexes
inventoryMovementSchema.index({ product: 1, createdAt: -1 });
inventoryMovementSchema.index({ seller: 1, type: 1, createdAt: -1 });
// Idempotency: Prevent duplicate order deductions or return restorations
inventoryMovementSchema.index(
  { product: 1, referenceType: 1, referenceId: 1, type: 1 },
  { unique: true, partialFilterExpression: { referenceType: { $ne: 'None' } } }
);

const InventoryMovement = mongoose.model('InventoryMovement', inventoryMovementSchema);

module.exports = InventoryMovement;
