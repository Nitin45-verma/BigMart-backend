const productService = require('../services/productService');
const productSearchService = require('../services/productSearchService');

/**
 * Seller: Create product
 */
const createProduct = async (req, res, next) => {
  try {
    const product = await productService.createSellerProduct(req.user.userId, req.body);
    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: { product }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Seller: List own products
 */
const getSellerProducts = async (req, res, next) => {
  try {
    const { page, limit, status, search } = req.query;
    const result = await productService.getSellerProducts(req.user.userId, { page, limit, status, search });
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Seller: Get own single product
 */
const getSellerProductById = async (req, res, next) => {
  try {
    const product = await productService.getSellerProductById(req.user.userId, req.params.productId);
    res.status(200).json({
      success: true,
      data: { product }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Seller: Update own product
 */
const updateSellerProduct = async (req, res, next) => {
  try {
    const product = await productService.updateSellerProduct(req.user.userId, req.params.productId, req.body);
    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: { product }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Seller: Delete (archive) own product
 */
const deleteSellerProduct = async (req, res, next) => {
  try {
    const result = await productService.deleteSellerProduct(req.user.userId, req.params.productId);
    res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Public: List active published products with search, filtering, sorting, pagination
 */
const getPublicProducts = async (req, res, next) => {
  try {
    const { q, categorySlug, categoryId, subCategory, brand, seller, minPrice, maxPrice, minRating, maxRating, inStock, minDiscount, sort, page, limit } = req.query;
    const result = await productSearchService.getPublicProducts({
      q,
      categorySlug,
      categoryId,
      subCategory,
      brand,
      seller,
      minPrice,
      maxPrice,
      minRating,
      maxRating,
      inStock,
      minStock: req.query.minStock, // fallback
      minDiscount,
      sort,
      page,
      limit
    });
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Public: Get product by category slug
 */
const getPublicProductsByCategorySlug = async (req, res, next) => {
  try {
    const { page, limit, sort, minPrice, maxPrice, brand } = req.query;
    const result = await productSearchService.getPublicProducts({
      categorySlug: req.params.categorySlug,
      brand,
      minPrice,
      maxPrice,
      sort,
      page,
      limit
    });
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Public: Get product by product slug
 */
const getPublicProductBySlug = async (req, res, next) => {
  try {
    const product = await productSearchService.getPublicProductBySlug(req.params.slug);
    res.status(200).json({
      success: true,
      data: { product }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createProduct,
  getSellerProducts,
  getSellerProductById,
  updateSellerProduct,
  deleteSellerProduct,
  getPublicProducts,
  getPublicProductsByCategorySlug,
  getPublicProductBySlug
};
