const sellerDashboardService = require('../services/sellerDashboardService');

/**
 * GET /api/v1/seller/dashboard/profile
 * Returns safe seller profile information for authenticated seller.
 */
const getProfile = async (req, res, next) => {
  try {
    const profile = sellerDashboardService.getSellerProfile(req.seller);
    res.status(200).json({
      success: true,
      data: profile
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/seller/dashboard/profile
 * Updates allowed seller business fields.
 */
const updateProfile = async (req, res, next) => {
  try {
    const profile = await sellerDashboardService.updateSellerProfile(req.seller, req.body);
    res.status(200).json({
      success: true,
      message: 'Seller business profile updated successfully',
      data: profile
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/seller/dashboard/summary
 * Returns product counts and financial metrics for seller dashboard.
 */
const getSummary = async (req, res, next) => {
  try {
    const summary = await sellerDashboardService.getDashboardSummary(req.seller);
    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/seller/dashboard/orders
 * Returns list of orders containing seller items (multi-vendor isolated).
 */
const getOrders = async (req, res, next) => {
  try {
    const result = await sellerDashboardService.getSellerOrders(req.seller, req.query);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/seller/dashboard/orders/:orderId
 * Returns order details for specific order containing seller items.
 */
const getOrderById = async (req, res, next) => {
  try {
    const order = await sellerDashboardService.getSellerOrderById(req.seller, req.params.orderId);
    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/seller/dashboard/products
 * Returns products belonging to authenticated seller.
 */
const getProducts = async (req, res, next) => {
  try {
    const result = await sellerDashboardService.getSellerProducts(req.seller, req.query);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/seller/dashboard/sales
 * Returns daily sales summary by period or custom date range.
 */
const getSalesSummary = async (req, res, next) => {
  try {
    const summary = await sellerDashboardService.getSellerSalesSummary(req.seller, req.query);
    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  getSummary,
  getOrders,
  getOrderById,
  getProducts,
  getSalesSummary
};
