const adminProductService = require('../services/adminProductService');

const getProducts = async (req, res, next) => {
  try {
    const result = await adminProductService.getProducts(req.query);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const getProductById = async (req, res, next) => {
  try {
    const product = await adminProductService.getProductById(req.params.productId);
    res.status(200).json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
};

const updateProductStatus = async (req, res, next) => {
  try {
    const result = await adminProductService.updateProductStatus(
      req.user.userId,
      req.params.productId,
      req.body,
      req
    );
    res.status(200).json({
      success: true,
      message: result.message,
      data: result.product
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /admin/products/:productId/publish
 * Sets product to active and published. Server controls the payload — no client override.
 */
const publishProduct = async (req, res, next) => {
  try {
    const result = await adminProductService.updateProductStatus(
      req.user.userId,
      req.params.productId,
      { status: 'active', isPublished: true },
      req
    );
    res.status(200).json({
      success: true,
      message: result.message,
      data: result.product
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /admin/products/:productId/unpublish
 * Sets product to inactive and unpublished.
 */
const unpublishProduct = async (req, res, next) => {
  try {
    const result = await adminProductService.updateProductStatus(
      req.user.userId,
      req.params.productId,
      { status: 'inactive', isPublished: false },
      req
    );
    res.status(200).json({
      success: true,
      message: result.message,
      data: result.product
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /admin/products/:productId/archive
 * Archives product and removes it from public catalog.
 */
const archiveProduct = async (req, res, next) => {
  try {
    const result = await adminProductService.updateProductStatus(
      req.user.userId,
      req.params.productId,
      { status: 'archived', isPublished: false },
      req
    );
    res.status(200).json({
      success: true,
      message: result.message,
      data: result.product
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProducts,
  getProductById,
  updateProductStatus,
  publishProduct,
  unpublishProduct,
  archiveProduct
};

