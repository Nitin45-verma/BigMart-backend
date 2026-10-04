const fulfillmentService = require('../services/fulfillmentService');
const shipmentService = require('../services/shipmentService');

// SELLER
const getSellerFulfillments = async (req, res, next) => {
  try {
    const { page, limit, status, orderId } = req.query;
    const result = await fulfillmentService.getSellerFulfillments(req.seller, { page, limit, status, orderId });
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const getFulfillmentById = async (req, res, next) => {
  try {
    const fulfillment = await fulfillmentService.getFulfillmentById(req.seller, req.params.fulfillmentId);
    res.status(200).json({ success: true, data: fulfillment });
  } catch (err) {
    next(err);
  }
};

const updateFulfillmentStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const fulfillment = await fulfillmentService.transitionFulfillmentStatus(req.seller, req.params.fulfillmentId, status);
    res.status(200).json({ success: true, message: `Status updated to ${status}`, data: fulfillment });
  } catch (err) {
    next(err);
  }
};

const createShipment = async (req, res, next) => {
  try {
    const { provider } = req.body;
    const shipment = await shipmentService.createShipment(req.params.fulfillmentId, req.seller, provider);
    res.status(201).json({ success: true, message: 'Shipment created successfully', data: shipment });
  } catch (err) {
    next(err);
  }
};

const getSellerTracking = async (req, res, next) => {
  try {
    const fulfillment = await fulfillmentService.getFulfillmentById(req.seller, req.params.fulfillmentId);
    if (!fulfillment.shipment) {
      return res.status(404).json({ success: false, message: 'No shipment created yet' });
    }
    const shipment = await shipmentService.getShipmentById(fulfillment.shipment._id || fulfillment.shipment);
    res.status(200).json({ success: true, data: shipment });
  } catch (err) {
    next(err);
  }
};

// ADMIN
const getAdminFulfillments = async (req, res, next) => {
  try {
    const { page, limit, seller, status } = req.query;
    const result = await fulfillmentService.getAdminFulfillments({ page, limit, seller, status });
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getSellerFulfillments,
  getFulfillmentById,
  updateFulfillmentStatus,
  createShipment,
  getSellerTracking,
  getAdminFulfillments
};
