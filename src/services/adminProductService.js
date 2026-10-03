const Product = require('../models/Product');
const ApiError = require('../utils/ApiError');
const { logAdminAction } = require('./adminAuditService');

/**
 * Returns paginated product catalog for administrative moderation.
 */
const getProducts = async ({ page = 1, limit = 20, search, seller, category, status, isPublished }) => {
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const query = {};

  if (seller) query.seller = seller;
  if (category) query.category = category;
  if (status) query.status = status;
  if (isPublished !== undefined && isPublished !== '') {
    query.isPublished = String(isPublished) === 'true';
  }

  if (search && typeof search === 'string' && search.trim().length > 0) {
    const searchRegex = new RegExp(search.trim(), 'i');
    query.$or = [
      { name: searchRegex },
      { sku: searchRegex },
      { brand: searchRegex }
    ];
  }

  const [products, total] = await Promise.all([
    Product.find(query)
      .populate('category', 'name slug')
      .populate('seller', 'businessName businessType verificationStatus')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Product.countDocuments(query)
  ]);

  return {
    products,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum)
  };
};

/**
 * Returns single product detail for admin review.
 */
const getProductById = async (productId) => {
  const product = await Product.findById(productId)
    .populate('category', 'name slug')
    .populate('seller', 'businessName businessType verificationStatus')
    .lean();

  if (!product) {
    throw new ApiError(404, 'Product not found');
  }

  return product;
};

/**
 * Moderates product status / publication status.
 * Rejects seller ownership changes, costPrice mutation, or historical data corruption.
 */
const updateProductStatus = async (adminId, productId, { status, isPublished }, req) => {
  const product = await Product.findById(productId);
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }

  const validStatuses = ['draft', 'active', 'inactive', 'out_of_stock', 'archived'];
  const updateFields = {};

  if (status !== undefined) {
    if (!validStatuses.includes(status)) {
      throw new ApiError(400, `Invalid product status '${status}'. Allowed: ${validStatuses.join(', ')}`);
    }
    updateFields.status = status;
  }

  if (isPublished !== undefined) {
    updateFields.isPublished = Boolean(isPublished);
  }

  if (Object.keys(updateFields).length === 0) {
    throw new ApiError(400, 'Specify status or isPublished to update product state');
  }

  const previousStatus = product.status;
  const previousIsPublished = product.isPublished;

  Object.assign(product, updateFields);
  await product.save();

  await logAdminAction({
    adminId,
    action: 'PRODUCT_STATUS_CHANGED',
    targetType: 'Product',
    targetId: productId,
    metadata: {
      productName: product.name,
      previousStatus,
      newStatus: product.status,
      previousIsPublished,
      newIsPublished: product.isPublished
    },
    req
  });

  return {
    message: 'Product moderation status updated successfully',
    product
  };
};

module.exports = {
  getProducts,
  getProductById,
  updateProductStatus
};
