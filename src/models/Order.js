const mongoose = require('mongoose');

const orderItemSnapshotSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Seller',
      required: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    sku: {
      type: String,
      required: true,
      trim: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0
    },
    gstRate: {
      type: Number,
      default: 0,
      min: 0
    },
    gstAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    itemSubtotal: {
      type: Number,
      required: true,
      min: 0
    },
    itemTotal: {
      type: Number,
      required: true,
      min: 0
    },
    costPrice: {
      type: Number,
      min: 0,
      default: null
    }
  },
  { _id: false }
);

const shippingAddressSnapshotSchema = new mongoose.Schema(
  {
    fullName: { type: String, trim: true },
    phone: { type: String, trim: true },
    addressLine1: { type: String, trim: true },
    addressLine2: { type: String, trim: true },
    landmark: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true, default: 'India' },
    postalCode: { type: String, trim: true },
    latitude: { type: Number },
    longitude: { type: Number }
  },
  { _id: false }
);

const sellerShippingSnapshotSchema = new mongoose.Schema(
  {
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true },
    sellerName: { type: String, trim: true },
    distanceKm: { type: Number, required: true },
    billableDistanceKm: { type: Number, required: true },
    deliveryFee: { type: Number, required: true }
  },
  { _id: false }
);

const shippingSnapshotSchema = new mongoose.Schema(
  {
    totalDeliveryFee: { type: Number, required: true, default: 0 },
    sellers: [sellerShippingSnapshotSchema]
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: [true, 'Order number is required'],
      unique: true,
      index: true,
      trim: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required for Order'],
      index: true
    },
    items: [orderItemSnapshotSchema],
    shippingAddress: {
      type: shippingAddressSnapshotSchema,
      required: [true, 'Shipping address snapshot is required']
    },
    shipping: {
      type: shippingSnapshotSchema
    },
    subtotal: {
      type: Number,
      required: [true, 'Order subtotal is required'],
      min: 0
    },
    gstTotal: {
      type: Number,
      required: [true, 'GST total is required'],
      min: 0
    },
    deliveryFee: {
      type: Number,
      default: 0,
      min: 0
    },
    platformFee: {
      type: Number,
      default: 0,
      min: 0
    },
    coupon: {
      couponId: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon' },
      code: { type: String, trim: true },
      discountType: { type: String, enum: ['percentage', 'fixed'] },
      discountValue: { type: Number, min: 0 },
      discountAmount: { type: Number, min: 0 }
    },
    discount: {
      type: Number,
      default: 0,
      min: 0
    },
    grandTotal: {
      type: Number,
      required: [true, 'Grand total is required'],
      min: 0
    },
    payment: {
      provider: {
        type: String,
        default: 'razorpay'
      },
      razorpayOrderId: {
        type: String,
        index: true
      },
      razorpayPaymentId: {
        type: String
      },
      razorpaySignature: {
        type: String
      },
      status: {
        type: String,
        enum: ['created', 'pending', 'paid', 'failed', 'refunded'],
        default: 'created'
      }
    },
    orderStatus: {
      type: String,
      enum: ['pending_payment', 'paid', 'processing', 'shipped', 'out_of_delivery', 'delivered', 'cancelled'],
      default: 'pending_payment',
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Compound index for querying user orders efficiently
orderSchema.index({ user: 1, orderStatus: 1, createdAt: -1 });

// Compound index for querying seller orders efficiently
orderSchema.index({ 'items.seller': 1, 'payment.status': 1, createdAt: -1 });
orderSchema.index({ 'items.seller': 1, orderStatus: 1, createdAt: -1 });

// Compound index for admin order listing and analytics queries
orderSchema.index({ orderStatus: 1, 'payment.status': 1, createdAt: -1 });
orderSchema.index({ createdAt: -1 });

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
