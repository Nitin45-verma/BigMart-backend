const shipmentService = require('../services/shipmentService');
const Shipment = require('../models/Shipment');
const Order = require('../models/Order');
const ApiError = require('../utils/ApiError');
const mongoose = require('mongoose');

// ADMIN
const getAdminShipments = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, provider, status } = req.query;
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
    const skip = (pageNum - 1) * limitNum;

    const query = {};
    if (provider) query.provider = provider;
    if (status) query.status = status;

    const [shipments, total] = await Promise.all([
      Shipment.find(query)
        .populate('order', 'orderNumber orderStatus')
        .populate('seller', 'businessName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Shipment.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: {
        shipments,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    next(err);
  }
};

const getShipmentById = async (req, res, next) => {
  try {
    const shipment = await shipmentService.getShipmentById(req.params.shipmentId);
    res.status(200).json({ success: true, data: shipment });
  } catch (err) {
    next(err);
  }
};

const updateShipmentStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const shipment = await shipmentService.transitionShipmentStatusByAdmin(
      req.user.userId,
      req.params.shipmentId,
      status,
      req
    );
    res.status(200).json({
      success: true,
      message: `Shipment status updated to ${status}`,
      data: shipment
    });
  } catch (err) {
    next(err);
  }
};

// CUSTOMER
const getOrderTracking = async (req, res, next) => {
  try {
    const orderId = req.params.orderId;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      throw new ApiError(400, 'Invalid order ID');
    }

    const order = await Order.findOne({ _id: orderId, user: req.user.userId }).lean();
    if (!order) {
      throw new ApiError(404, 'Order not found');
    }

    // Get shipments for this order
    const shipments = await Shipment.find({ order: order._id })
      .select('-metadata -pickupScheduledAt')
      .populate('seller', 'businessName')
      .populate('fulfillment', 'status packedAt readyToShipAt items')
      .lean();

    const trackingData = shipments.map(s => {
      // Map safe properties
      return {
        seller: {
          id: s.seller._id,
          name: s.seller.businessName
        },
        fulfillmentStatus: s.fulfillment?.status,
        shipmentStatus: s.status,
        awbNumber: s.awbNumber,
        trackingNumber: s.trackingNumber,
        trackingUrl: s.trackingUrl,
        estimatedDeliveryDate: s.estimatedDeliveryDate,
        timeline: {
          packedAt: s.fulfillment?.packedAt,
          readyToShipAt: s.fulfillment?.readyToShipAt,
          shippedAt: s.shippedAt,
          deliveredAt: s.deliveredAt
        }
      };
    });

    res.status(200).json({
      success: true,
      data: {
        orderStatus: order.orderStatus,
        tracking: trackingData
      }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAdminShipments,
  getShipmentById,
  updateShipmentStatus,
  getOrderTracking
};
