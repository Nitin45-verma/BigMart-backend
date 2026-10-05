const analyticsService = require('../services/analyticsService');

const handleResponse = async (req, res, data) => {
  if (req.query.format === 'csv') {
    const csv = await analyticsService.generateCSV(Array.isArray(data) ? data : [data]);
    res.header('Content-Type', 'text/csv');
    res.attachment('report.csv');
    return res.status(200).send(csv);
  }
  return res.status(200).json({ success: true, data });
};

exports.getOverview = async (req, res, next) => {
  try {
    const sellerId = (req.seller && req.seller._id) ? req.seller._id : req.user.userId;
    const data = await analyticsService.getSellerOverview(sellerId, req.query);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.getSalesTrend = async (req, res, next) => {
  try {
    res.status(200).json({ success: true, data: [] });
  } catch (error) {
    next(error);
  }
};

exports.getProducts = async (req, res, next) => {
  res.status(200).json({ success: true, data: [] });
};

exports.getTopProducts = async (req, res, next) => {
  res.status(200).json({ success: true, data: [] });
};

exports.getInventory = async (req, res, next) => {
  res.status(200).json({ success: true, data: {} });
};

exports.getReturns = async (req, res, next) => {
  res.status(200).json({ success: true, data: {} });
};

exports.getCancellations = async (req, res, next) => {
  res.status(200).json({ success: true, data: {} });
};

exports.getPayouts = async (req, res, next) => {
  res.status(200).json({ success: true, data: {} });
};

// Seller Reports Endpoints
exports.getSalesReport = async (req, res, next) => handleResponse(req, res, []);
exports.getOrdersReport = async (req, res, next) => handleResponse(req, res, []);
exports.getProductsReport = async (req, res, next) => handleResponse(req, res, []);
exports.getPayoutsReport = async (req, res, next) => handleResponse(req, res, []);
