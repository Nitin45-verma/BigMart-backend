const mongoose = require('mongoose');

const shipmentSchema = new mongoose.Schema(
  {
    fulfillment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Fulfillment',
      required: true,
      index: true
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Seller',
      required: true,
      index: true
    },
    provider: {
      type: String,
      required: true,
      trim: true
    },
    providerCode: {
      type: String,
      trim: true,
      default: null
    },
    awbNumber: {
      type: String,
      trim: true,
      index: true
    },
    trackingNumber: {
      type: String,
      trim: true,
      index: true
    },
    status: {
      type: String,
      required: true,
      default: 'SHIPPED'
    },
    pickupScheduledAt: Date,
    pickedUpAt: Date,
    shippedAt: Date,
    deliveredAt: Date,
    estimatedDeliveryDate: Date,
    trackingUrl: {
      type: String,
      trim: true,
      default: null
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

// One active shipment per fulfillment ideally
shipmentSchema.index({ seller: 1, status: 1, createdAt: -1 });
shipmentSchema.index({ trackingNumber: 1 });

const Shipment = mongoose.model('Shipment', shipmentSchema);
module.exports = Shipment;
