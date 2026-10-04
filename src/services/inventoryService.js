const mongoose = require('mongoose');
const Product = require('../models/Product');
const Seller = require('../models/Seller');
const InventoryMovement = require('../models/InventoryMovement');
const { Notification } = require('../models/Notification');
const ApiError = require('../utils/ApiError');

const checkAndNotifyStock = async (product, previousStock, newStock, performedBy) => {
  try {
    const seller = await Seller.findById(product.seller);
    if (!seller) return;

    const threshold = product.lowStockThreshold || 5;

    // Check transition to OUT_OF_STOCK
    if (previousStock > 0 && newStock <= 0) {
      await Notification.create({
        recipient: seller.user,
        recipientRole: 'seller',
        type: 'SELLER_OUT_OF_STOCK',
        title: 'Product Out of Stock',
        message: `Your product '${product.name}' is out of stock.`,
        data: { productId: product._id },
        eventKey: `SELLER_OUT_OF_STOCK:${product._id}:${Date.now()}`
      });
    }
    // Check transition to LOW_STOCK (and not out of stock, or if it dropped from above threshold to out of stock directly, it already got out of stock, but we can also send low stock if we want, but typically it's fine)
    else if (previousStock > threshold && newStock <= threshold && newStock > 0) {
      await Notification.create({
        recipient: seller.user,
        recipientRole: 'seller',
        type: 'SELLER_LOW_STOCK',
        title: 'Low Stock Alert',
        message: `Your product '${product.name}' is running low on stock (${newStock} remaining).`,
        data: { productId: product._id },
        eventKey: `SELLER_LOW_STOCK:${product._id}:${Date.now()}`
      });
    }
  } catch (error) {
    console.error('Failed to send stock notification:', error);
    // Notification failure must NOT roll back successful inventory changes.
  }
};

const getSellerInventory = async (userId, { page = 1, limit = 20, q, category, stockStatus, sort }) => {
  const seller = await Seller.findOne({ user: userId });
  if (!seller) throw new ApiError(403, 'Seller profile not found');

  const query = { seller: seller._id };

  if (q) {
    query.$or = [
      { sku: { $regex: q, $options: 'i' } },
      { name: { $regex: q, $options: 'i' } }
    ];
  }

  if (category) {
    query.category = category;
  }

  if (stockStatus === 'out_of_stock') {
    query.stock = 0;
  } else if (stockStatus === 'low_stock') {
    query.$expr = { $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', '$lowStockThreshold'] }] };
  } else if (stockStatus === 'in_stock') {
    query.$expr = { $gt: ['$stock', '$lowStockThreshold'] };
  }

  let sortCriteria = { createdAt: -1 };
  if (sort === 'stock_asc') sortCriteria = { stock: 1 };
  if (sort === 'stock_desc') sortCriteria = { stock: -1 };

  const skip = (page - 1) * limit;

  const products = await Product.find(query)
    .select('-costPrice') // Protect financial fields unless explicitly required by other scopes, but standard list hides it. We can show it if needed, but safe to omit
    .sort(sortCriteria)
    .skip(skip)
    .limit(limit)
    .lean();

  const total = await Product.countDocuments(query);

  // Map stock status for response
  const mappedProducts = products.map(p => {
    let status = 'in_stock';
    if (p.stock === 0) status = 'out_of_stock';
    else if (p.stock <= p.lowStockThreshold) status = 'low_stock';
    
    return {
      ...p,
      stockStatus: status
    };
  });

  return {
    inventory: mappedProducts,
    page: Number(page),
    limit: Number(limit),
    total,
    totalPages: Math.ceil(total / limit)
  };
};

const getAdminInventory = async ({ page = 1, limit = 20, q, category, stockStatus, seller }) => {
  const query = {};

  if (seller) query.seller = seller;
  if (category) query.category = category;
  if (q) {
    query.$or = [
      { sku: { $regex: q, $options: 'i' } },
      { name: { $regex: q, $options: 'i' } }
    ];
  }

  if (stockStatus === 'out_of_stock') {
    query.stock = 0;
  } else if (stockStatus === 'low_stock') {
    query.$expr = { $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', '$lowStockThreshold'] }] };
  } else if (stockStatus === 'in_stock') {
    query.$expr = { $gt: ['$stock', '$lowStockThreshold'] };
  }

  const skip = (page - 1) * limit;

  const products = await Product.find(query)
    .select('-costPrice')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const total = await Product.countDocuments(query);

  const mappedProducts = products.map(p => {
    let status = 'in_stock';
    if (p.stock === 0) status = 'out_of_stock';
    else if (p.stock <= p.lowStockThreshold) status = 'low_stock';
    return { ...p, stockStatus: status };
  });

  return {
    inventory: mappedProducts,
    page: Number(page),
    limit: Number(limit),
    total,
    totalPages: Math.ceil(total / limit)
  };
};

const stockIn = async (userId, productId, quantity, reason) => {
  const seller = await Seller.findOne({ user: userId });
  if (!seller) throw new ApiError(403, 'Seller profile not found');
  if (quantity <= 0) throw new ApiError(400, 'Quantity must be positive');

  const product = await Product.findOneAndUpdate(
    { _id: productId, seller: seller._id },
    { $inc: { stock: quantity } },
    { new: true } // Need new to get the updated stock, but wait, we need previous stock.
  );

  if (!product) {
    throw new ApiError(404, 'Product not found or access denied');
  }

  const previousStock = product.stock - quantity;
  const newStock = product.stock;

  const movement = await InventoryMovement.create({
    product: product._id,
    seller: seller._id,
    type: 'STOCK_IN',
    quantity,
    previousStock,
    newStock,
    reason,
    performedBy: userId
  });

  return { product, movement };
};

const stockOut = async (userId, productId, quantity, reason) => {
  const seller = await Seller.findOne({ user: userId });
  if (!seller) throw new ApiError(403, 'Seller profile not found');
  if (quantity <= 0) throw new ApiError(400, 'Quantity must be positive');

  // Atomic conditional update to prevent negative stock
  const product = await Product.findOneAndUpdate(
    { _id: productId, seller: seller._id, stock: { $gte: quantity } },
    { $inc: { stock: -quantity } },
    { new: true }
  );

  if (!product) {
    // Check if product exists but has insufficient stock
    const existing = await Product.findOne({ _id: productId, seller: seller._id });
    if (!existing) {
      throw new ApiError(404, 'Product not found or access denied');
    }
    throw new ApiError(409, `Insufficient stock. Only ${existing.stock} available.`);
  }

  const previousStock = product.stock + quantity;
  const newStock = product.stock;

  const movement = await InventoryMovement.create({
    product: product._id,
    seller: seller._id,
    type: 'STOCK_OUT',
    quantity,
    previousStock,
    newStock,
    reason,
    performedBy: userId
  });

  await checkAndNotifyStock(product, previousStock, newStock, userId);

  return { product, movement };
};

const adjustStock = async (userId, productId, adjustment, reason) => {
  const seller = await Seller.findOne({ user: userId });
  if (!seller) throw new ApiError(403, 'Seller profile not found');
  if (adjustment === 0) throw new ApiError(400, 'Adjustment cannot be zero');

  let product;
  if (adjustment > 0) {
    product = await Product.findOneAndUpdate(
      { _id: productId, seller: seller._id },
      { $inc: { stock: adjustment } },
      { new: true }
    );
  } else {
    // Decrease
    product = await Product.findOneAndUpdate(
      { _id: productId, seller: seller._id, stock: { $gte: Math.abs(adjustment) } },
      { $inc: { stock: adjustment } },
      { new: true }
    );
  }

  if (!product) {
    if (adjustment < 0) {
      const existing = await Product.findOne({ _id: productId, seller: seller._id });
      if (!existing) throw new ApiError(404, 'Product not found or access denied');
      throw new ApiError(409, `Insufficient stock. Only ${existing.stock} available.`);
    }
    throw new ApiError(404, 'Product not found or access denied');
  }

  const previousStock = product.stock - adjustment;
  const newStock = product.stock;

  const movement = await InventoryMovement.create({
    product: product._id,
    seller: seller._id,
    type: adjustment > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
    quantity: Math.abs(adjustment),
    previousStock,
    newStock,
    reason,
    performedBy: userId
  });

  if (adjustment < 0) {
    await checkAndNotifyStock(product, previousStock, newStock, userId);
  }

  return { product, movement };
};

const updateThreshold = async (userId, productId, lowStockThreshold) => {
  const seller = await Seller.findOne({ user: userId });
  if (!seller) throw new ApiError(403, 'Seller profile not found');

  const product = await Product.findOneAndUpdate(
    { _id: productId, seller: seller._id },
    { $set: { lowStockThreshold } },
    { new: true }
  );

  if (!product) {
    throw new ApiError(404, 'Product not found or access denied');
  }

  return product;
};

const getMovements = async (userId, productId, { page = 1, limit = 20, type }) => {
  const seller = await Seller.findOne({ user: userId });
  if (!seller) throw new ApiError(403, 'Seller profile not found');

  const product = await Product.findOne({ _id: productId, seller: seller._id });
  if (!product) throw new ApiError(404, 'Product not found or access denied');

  const query = { product: productId, seller: seller._id };
  if (type) query.type = type;

  const skip = (page - 1) * limit;

  const movements = await InventoryMovement.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const total = await InventoryMovement.countDocuments(query);

  return {
    movements,
    page: Number(page),
    limit: Number(limit),
    total,
    totalPages: Math.ceil(total / limit)
  };
};

const getAdminMovements = async (productId, { page = 1, limit = 20, type }) => {
  const product = await Product.findById(productId);
  if (!product) throw new ApiError(404, 'Product not found');

  const query = { product: productId };
  if (type) query.type = type;

  const skip = (page - 1) * limit;

  const movements = await InventoryMovement.find(query)
    .populate('seller', 'businessName')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const total = await InventoryMovement.countDocuments(query);

  return {
    movements,
    page: Number(page),
    limit: Number(limit),
    total,
    totalPages: Math.ceil(total / limit)
  };
};

// Internal API for other services (Order/Return)
const recordMovement = async ({ product, seller, type, quantity, previousStock, newStock, reason, referenceType, referenceId, performedBy, metadata }) => {
  try {
    await InventoryMovement.create({
      product,
      seller,
      type,
      quantity,
      previousStock,
      newStock,
      reason,
      referenceType,
      referenceId,
      performedBy,
      metadata
    });
    
    // Only order deductions or return adjustments might trigger this, though typically handled via update Product. 
    // Here we just record the movement. The caller updates the product.
    // So the caller is responsible for fetching the product and triggering notifications if needed, 
    // but we can also trigger notifications here since we have previous/new stock.
    const p = await Product.findById(product);
    if (p) {
      await checkAndNotifyStock(p, previousStock, newStock, performedBy);
    }
  } catch (err) {
    if (err.code === 11000) {
      // Idempotency: duplicate movement, ignore
      return;
    }
    console.error('Failed to record inventory movement:', err);
  }
};

module.exports = {
  getSellerInventory,
  getAdminInventory,
  stockIn,
  stockOut,
  adjustStock,
  updateThreshold,
  getMovements,
  getAdminMovements,
  recordMovement
};
