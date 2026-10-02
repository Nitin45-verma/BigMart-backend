const Product = require('../models/Product');
const Seller = require('../models/Seller');
const Category = require('../models/Category');
const ApiError = require('../utils/ApiError');
const { slugify } = require('../utils/slugUtils');

/**
 * Helper to ensure unique product slug generation.
 */
const generateUniqueProductSlug = async (name, currentProductId = null) => {
  let baseSlug = slugify(name);
  if (!baseSlug) baseSlug = 'product';

  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const query = { slug };
    if (currentProductId) {
      query._id = { $ne: currentProductId };
    }
    const existing = await Product.findOne(query);
    if (!existing) break;

    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }

  return slug;
};

/**
 * Seller: Create a new product.
 */
const createSellerProduct = async (userId, productData) => {
  // Verify seller account and active status
  const seller = await Seller.findOne({ user: userId });
  if (!seller || seller.verificationStatus !== 'approved') {
    throw new ApiError(403, 'Only approved sellers with active profiles can create products');
  }

  // Validate category existence and active state
  const category = await Category.findOne({ _id: productData.category, isActive: true });
  if (!category) {
    throw new ApiError(400, 'Selected category is invalid or inactive');
  }

  // If subCategory provided, validate it
  if (productData.subCategory) {
    const subCat = await Category.findOne({ _id: productData.subCategory, isActive: true });
    if (!subCat) {
      throw new ApiError(400, 'Selected subCategory is invalid or inactive');
    }
  }

  // Verify SKU uniqueness for this seller
  const skuTrimmed = productData.sku.trim();
  const existingSku = await Product.findOne({ seller: seller._id, sku: skuTrimmed });
  if (existingSku) {
    throw new ApiError(409, `Product SKU '${skuTrimmed}' already exists for your seller account`);
  }

  const slug = await generateUniqueProductSlug(productData.name);

  // Precision money representation (rounded to 2 decimal places)
  const price = Math.round(productData.price * 100) / 100;
  const compareAtPrice = productData.compareAtPrice !== undefined ? Math.round(productData.compareAtPrice * 100) / 100 : undefined;
  const costPrice = productData.costPrice !== undefined ? Math.round(productData.costPrice * 100) / 100 : undefined;

  const product = await Product.create({
    seller: seller._id,
    category: category._id,
    subCategory: productData.subCategory || null,
    name: productData.name.trim(),
    slug,
    shortDescription: productData.shortDescription ? productData.shortDescription.trim() : undefined,
    description: productData.description ? productData.description.trim() : undefined,
    brand: productData.brand ? productData.brand.trim() : undefined,
    sku: skuTrimmed,
    images: productData.images || [],
    price,
    compareAtPrice,
    costPrice,
    gstRate: productData.gstRate,
    stock: productData.stock,
    lowStockThreshold: productData.lowStockThreshold !== undefined ? productData.lowStockThreshold : 5,
    weight: productData.weight,
    status: productData.status || 'draft',
    isPublished: productData.isPublished !== undefined ? productData.isPublished : false
  });

  return product;
};

/**
 * Seller: List own products with pagination, filtering, and search.
 * Includes costPrice for seller's internal view.
 */
const getSellerProducts = async (userId, { page = 1, limit = 20, status, search }) => {
  const seller = await Seller.findOne({ user: userId });
  if (!seller) {
    throw new ApiError(403, 'Seller profile not found');
  }

  const query = { seller: seller._id };
  if (status && ['draft', 'active', 'inactive', 'out_of_stock', 'archived'].includes(status)) {
    query.status = status;
  }

  if (search && search.trim()) {
    query.$or = [
      { name: new RegExp(search.trim(), 'i') },
      { sku: new RegExp(search.trim(), 'i') },
      { brand: new RegExp(search.trim(), 'i') }
    ];
  }

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
  const skip = (pageNum - 1) * limitNum;

  const products = await Product.find(query)
    .select('+costPrice') // Include seller-only costPrice
    .populate('category', 'name slug')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum);

  const total = await Product.countDocuments(query);

  return {
    products,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum)
  };
};

/**
 * Seller: Get single product by ID (ownership protected).
 * Includes costPrice for seller.
 */
const getSellerProductById = async (userId, productId) => {
  const seller = await Seller.findOne({ user: userId });
  if (!seller) {
    throw new ApiError(403, 'Seller profile not found');
  }

  const product = await Product.findOne({ _id: productId, seller: seller._id })
    .select('+costPrice')
    .populate('category', 'name slug');

  if (!product) {
    throw new ApiError(404, 'Product not found or access denied');
  }

  return product;
};

/**
 * Seller: Update own product.
 */
const updateSellerProduct = async (userId, productId, updateData) => {
  const seller = await Seller.findOne({ user: userId });
  if (!seller || seller.verificationStatus !== 'approved') {
    throw new ApiError(403, 'Only active approved sellers can update products');
  }

  const product = await Product.findOne({ _id: productId, seller: seller._id }).select('+costPrice');
  if (!product) {
    throw new ApiError(404, 'Product not found or access denied');
  }

  if (updateData.category && updateData.category.toString() !== product.category.toString()) {
    const category = await Category.findOne({ _id: updateData.category, isActive: true });
    if (!category) {
      throw new ApiError(400, 'Selected category is invalid or inactive');
    }
    product.category = category._id;
  }

  if (updateData.subCategory !== undefined) {
    if (updateData.subCategory) {
      const subCat = await Category.findOne({ _id: updateData.subCategory, isActive: true });
      if (!subCat) {
        throw new ApiError(400, 'Selected subCategory is invalid or inactive');
      }
      product.subCategory = subCat._id;
    } else {
      product.subCategory = null;
    }
  }

  if (updateData.sku && updateData.sku.trim() !== product.sku) {
    const newSku = updateData.sku.trim();
    const existingSku = await Product.findOne({ seller: seller._id, sku: newSku, _id: { $ne: productId } });
    if (existingSku) {
      throw new ApiError(409, `Product SKU '${newSku}' already exists for your seller account`);
    }
    product.sku = newSku;
  }

  if (updateData.name && updateData.name.trim() !== product.name) {
    product.name = updateData.name.trim();
    product.slug = await generateUniqueProductSlug(product.name, productId);
  }

  if (updateData.shortDescription !== undefined) product.shortDescription = updateData.shortDescription ? updateData.shortDescription.trim() : undefined;
  if (updateData.description !== undefined) product.description = updateData.description ? updateData.description.trim() : undefined;
  if (updateData.brand !== undefined) product.brand = updateData.brand ? updateData.brand.trim() : undefined;
  if (updateData.images !== undefined) product.images = updateData.images;

  if (updateData.price !== undefined) product.price = Math.round(updateData.price * 100) / 100;
  if (updateData.compareAtPrice !== undefined) product.compareAtPrice = Math.round(updateData.compareAtPrice * 100) / 100;
  if (updateData.costPrice !== undefined) product.costPrice = Math.round(updateData.costPrice * 100) / 100;

  if (updateData.gstRate !== undefined) product.gstRate = updateData.gstRate;
  if (updateData.stock !== undefined) product.stock = updateData.stock;
  if (updateData.lowStockThreshold !== undefined) product.lowStockThreshold = updateData.lowStockThreshold;
  if (updateData.weight !== undefined) product.weight = updateData.weight;
  if (updateData.status !== undefined) product.status = updateData.status;
  if (updateData.isPublished !== undefined) product.isPublished = updateData.isPublished;

  await product.save();
  return product;
};

/**
 * Seller: Soft delete / archive product.
 */
const deleteSellerProduct = async (userId, productId) => {
  const seller = await Seller.findOne({ user: userId });
  if (!seller) {
    throw new ApiError(403, 'Seller profile not found');
  }

  const product = await Product.findOne({ _id: productId, seller: seller._id });
  if (!product) {
    throw new ApiError(404, 'Product not found or access denied');
  }

  // Soft deletion / archiving
  product.status = 'archived';
  product.isPublished = false;
  await product.save();

  return { message: 'Product archived successfully' };
};

/**
 * Public: List active published products with search, category/price/brand filters, sorting, and pagination.
 * EXCLUDES costPrice.
 */
const getPublicProducts = async ({
  q,
  categorySlug,
  brand,
  minPrice,
  maxPrice,
  minStock,
  sort = 'newest',
  page = 1,
  limit = 20
}) => {
  const query = {
    status: 'active',
    isPublished: true
  };

  if (categorySlug) {
    const category = await Category.findOne({ slug: categorySlug.toLowerCase().trim(), isActive: true });
    if (!category) {
      return {
        products: [],
        total: 0,
        page: parseInt(page, 10) || 1,
        limit: Math.min(parseInt(limit, 10) || 20, 50),
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false
      };
    }
    query.category = category._id;
  }

  if (q && q.trim()) {
    const searchRegex = new RegExp(q.trim(), 'i');
    query.$or = [
      { name: searchRegex },
      { brand: searchRegex },
      { shortDescription: searchRegex },
      { description: searchRegex }
    ];
  }

  if (brand && brand.trim()) {
    query.brand = new RegExp(`^${brand.trim()}$`, 'i');
  }

  if (minPrice !== undefined || maxPrice !== undefined) {
    query.price = {};
    if (minPrice !== undefined && !isNaN(Number(minPrice))) query.price.$gte = Number(minPrice);
    if (maxPrice !== undefined && !isNaN(Number(maxPrice))) query.price.$lte = Number(maxPrice);
  }

  if (minStock !== undefined && !isNaN(Number(minStock))) {
    query.stock = { $gte: Number(minStock) };
  }

  // Sorting whitelist mapping
  let sortOption = { createdAt: -1 };
  if (sort === 'price_low_to_high') {
    sortOption = { price: 1 };
  } else if (sort === 'price_high_to_low') {
    sortOption = { price: -1 };
  } else if (sort === 'name') {
    sortOption = { name: 1 };
  } else if (sort === 'newest') {
    sortOption = { createdAt: -1 };
  }

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50); // Enforce max limit of 50
  const skip = (pageNum - 1) * limitNum;

  const products = await Product.find(query)
    // costPrice is select: false, so it is automatically excluded
    .populate('category', 'name slug')
    .populate('seller', 'businessName businessType')
    .sort(sortOption)
    .skip(skip)
    .limit(limitNum);

  const total = await Product.countDocuments(query);
  const totalPages = Math.ceil(total / limitNum);

  return {
    products,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages,
    hasNextPage: pageNum < totalPages,
    hasPreviousPage: pageNum > 1
  };
};

/**
 * Public: Get active published product details by slug.
 * EXCLUDES costPrice.
 */
const getPublicProductBySlug = async (slug) => {
  const product = await Product.findOne({
    slug: slug.toLowerCase().trim(),
    status: 'active',
    isPublished: true
  })
    .populate('category', 'name slug')
    .populate('seller', 'businessName businessType');

  if (!product) {
    throw new ApiError(404, 'Product not found');
  }

  return product;
};

module.exports = {
  createSellerProduct,
  getSellerProducts,
  getSellerProductById,
  updateSellerProduct,
  deleteSellerProduct,
  getPublicProducts,
  getPublicProductBySlug
};
