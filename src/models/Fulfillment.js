const mongoose = require('mongoose');

const fulfillmentItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    sku: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const fulfillmentSchema = new mongoose.Schema(
  {
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
    items: [fulfillmentItemSchema],
    status: {
      type: String,
      enum: [
        'PROCESSING',
        'PACKING',
        'READY_TO_SHIP',
        'SHIPPED',
        'IN_TRANSIT',
        'OUT_FOR_DELIVERY',
        'DELIVERED',
        'DELIVERY_FAILED',
        'CANCELLED'
      ],
      default: 'PROCESSING',
      index: true
    },
    shipment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shipment',
      default: null
    },
    shippingAddressSnapshot: {
      fullName: String,
      phone: String,
      addressLine1: String,
      addressLine2: String,
      landmark: String,
      city: String,
      state: String,
      country: String,
      postalCode: String,
      latitude: Number,
      longitude: Number
    },
    estimatedDeliveryDate: {
      type: Date,
      default: null
    },
    packedAt: Date,
    readyToShipAt: Date,
    shippedAt: Date,
    deliveredAt: Date
  },
  {
    timestamps: true
  }
);

// Idempotency: One fulfillment per seller per order
fulfillmentSchema.index({ order: 1, seller: 1 }, { unique: true });

// For seller dashboard queries
fulfillmentSchema.index({ seller: 1, status: 1, createdAt: -1 });

const Fulfillment = mongoose.model('Fulfillment', fulfillmentSchema);
module.exports = Fulfillment;
