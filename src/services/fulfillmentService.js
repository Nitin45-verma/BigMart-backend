const mongoose = require('mongoose');
const Fulfillment = require('../models/Fulfillment');
const Order = require('../models/Order');
const ApiError = require('../utils/ApiError');

const createFulfillmentsForOrder = async (order) => {
  // Group items by seller
  const itemsBySeller = new Map();
  for (const item of order.items) {
    const sellerId = item.seller.toString();
    if (!itemsBySeller.has(sellerId)) {
      itemsBySeller.set(sellerId, []);
    }
    itemsBySeller.get(sellerId).push({
      product: item.product,
      name: item.name,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: item.unitPrice
    });
  }

  const fulfillments = [];
  for (const [sellerId, items] of itemsBySeller.entries()) {
    // Check if fulfillment already exists (Idempotency)
    const existing = await Fulfillment.findOne({ order: order._id, seller: sellerId });
    if (existing) {
      fulfillments.push(existing);
      continue;
    }

    const fulfillment = await Fulfillment.create({
      order: order._id,
      seller: sellerId,
      items,
      shippingAddressSnapshot: order.shippingAddress,
      status: 'PROCESSING'
    });
    fulfillments.push(fulfillment);
  }

  return fulfillments;
};

const getSellerFulfillments = async (sellerId, { page = 1, limit = 20, status, orderId }) => {
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
  const skip = (pageNum - 1) * limitNum;

  const query = { seller: sellerId };
  if (status) query.status = status;
  if (orderId && mongoose.Types.ObjectId.isValid(orderId)) query.order = orderId;

  const [fulfillments, total] = await Promise.all([
    Fulfillment.find(query)
      .populate('order', 'orderNumber orderStatus createdAt payment')
      .populate('shipment')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Fulfillment.countDocuments(query)
  ]);

  return {
    fulfillments,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum)
  };
};

const getFulfillmentById = async (sellerId, fulfillmentId) => {
  const fulfillment = await Fulfillment.findOne({ _id: fulfillmentId, seller: sellerId })
    .populate('order', 'orderNumber orderStatus createdAt payment.status')
    .populate('shipment');

  if (!fulfillment) {
    throw new ApiError(404, 'Fulfillment not found or access denied');
  }

  return fulfillment;
};

const transitionFulfillmentStatus = async (sellerId, fulfillmentId, newStatus) => {
  const validTransitions = {
    'PROCESSING': ['PACKING'],
    'PACKING': ['READY_TO_SHIP']
  };

  const fulfillment = await Fulfillment.findOne({ _id: fulfillmentId, seller: sellerId })
    .populate('order');
  if (!fulfillment) {
    throw new ApiError(404, 'Fulfillment not found');
  }

  const currentStatus = fulfillment.status;
  if (currentStatus === newStatus) return fulfillment;

  const allowed = validTransitions[currentStatus] || [];
  if (!allowed.includes(newStatus)) {
    throw new ApiError(400, `Cannot transition fulfillment from '${currentStatus}' to '${newStatus}'`);
  }

  fulfillment.status = newStatus;
  const now = new Date();
  
  if (newStatus === 'PACKING') {
    fulfillment.packedAt = now;
  } else if (newStatus === 'READY_TO_SHIP') {
    fulfillment.readyToShipAt = now;
  }

  await fulfillment.save();

  // If READY_TO_SHIP, could fire a notification or evaluate overall order status (like PROCESSING if not already)
  if (newStatus === 'READY_TO_SHIP' || newStatus === 'PACKING') {
    const order = await Order.findById(fulfillment.order._id);
    if (order.orderStatus === 'paid') {
      order.orderStatus = 'processing';
      await order.save();
    }
  }

  return fulfillment;
};

// Admin list
const getAdminFulfillments = async ({ page = 1, limit = 20, seller, status }) => {
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
  const skip = (pageNum - 1) * limitNum;

  const query = {};
  if (status) query.status = status;
  if (seller) query.seller = seller;

  const [fulfillments, total] = await Promise.all([
    Fulfillment.find(query)
      .populate('order', 'orderNumber orderStatus')
      .populate('seller', 'businessName')
      .populate('shipment')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Fulfillment.countDocuments(query)
  ]);

  return {
    fulfillments,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum)
  };
};

module.exports = {
  createFulfillmentsForOrder,
  getSellerFulfillments,
  getFulfillmentById,
  transitionFulfillmentStatus,
  getAdminFulfillments
};
