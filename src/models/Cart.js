const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product reference is required']
    },
    quantity: {
      type: Number,
      required: [true, 'Item quantity is required'],
      min: [1, 'Quantity must be at least 1'],
      max: [50, 'Quantity cannot exceed 50 per item'],
      default: 1
    }
  },
  { _id: false }
);

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required for Cart'],
      unique: true,
      index: true
    },
    items: [cartItemSchema]
  },
  {
    timestamps: true
  }
);

const Cart = mongoose.model('Cart', cartSchema);

module.exports = Cart;
