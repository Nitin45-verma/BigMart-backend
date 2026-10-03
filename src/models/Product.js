const mongoose = require('mongoose');

const productImageSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true },
    fileId: { type: String, trim: true },
    altText: { type: String, trim: true },
    sortOrder: { type: Number, default: 0 }
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Seller',
      required: [true, 'Seller reference is required'],
      index: true
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category reference is required'],
      index: true
    },
    subCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
      index: true
    },
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true
    },
    slug: {
      type: String,
      required: [true, 'Product slug is required'],
      unique: true,
      trim: true,
      lowercase: true,
      index: true
    },
    shortDescription: {
      type: String,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    brand: {
      type: String,
      trim: true,
      index: true
    },
    sku: {
      type: String,
      required: [true, 'Product SKU is required'],
      trim: true
    },
    images: [productImageSchema],
    price: {
      type: Number,
      required: [true, 'Selling price is required'],
      min: [0, 'Price cannot be negative']
    },
    compareAtPrice: {
      type: Number,
      min: [0, 'Compare price cannot be negative']
    },
    costPrice: {
      type: Number,
      min: [0, 'Cost price cannot be negative'],
      select: false // Sensitive costPrice hidden from default queries
    },
    gstRate: {
      type: Number,
      required: [true, 'GST rate is required'],
      default: 0,
      min: [0, 'GST rate cannot be negative'],
      max: [100, 'GST rate cannot exceed 100%']
    },
    stock: {
      type: Number,
      required: [true, 'Stock count is required'],
      default: 0,
      min: [0, 'Stock cannot be negative']
    },
    lowStockThreshold: {
      type: Number,
      default: 5,
      min: [0, 'Low stock threshold cannot be negative']
    },
    weight: {
      type: Number,
      min: [0, 'Weight cannot be negative']
    },
    status: {
      type: String,
      enum: {
        values: ['draft', 'active', 'inactive', 'out_of_stock', 'archived'],
        message: '{VALUE} is not a valid product status'
      },
      default: 'draft',
      index: true
    },
    isPublished: {
      type: Boolean,
      default: false,
      index: true
    },
    ratingAverage: {
      type: Number,
      default: 0,
      min: [0, 'Rating average cannot be negative'],
      max: [5, 'Rating average cannot exceed 5']
    },
    ratingCount: {
      type: Number,
      default: 0,
      min: [0, 'Rating count cannot be negative']
    },
    ratingBreakdown: {
      1: { type: Number, default: 0 },
      2: { type: Number, default: 0 },
      3: { type: Number, default: 0 },
      4: { type: Number, default: 0 },
      5: { type: Number, default: 0 }
    }
  },
  {
    timestamps: true
  }
);

// Compound unique index: SKU is unique per seller
productSchema.index({ seller: 1, sku: 1 }, { unique: true });

// Compound index for efficient public product browsing queries
productSchema.index({ status: 1, isPublished: 1, category: 1, price: 1 });

// Text index for text search capability
productSchema.index({
  name: 'text',
  brand: 'text',
  shortDescription: 'text',
  description: 'text'
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
