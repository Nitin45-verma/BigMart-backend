const mongoose = require('mongoose');
const Shipment = require('../models/Shipment');
const Fulfillment = require('../models/Fulfillment');
const Order = require('../models/Order');
const ApiError = require('../utils/ApiError');
const mockProvider = require('./shippingProviders/mockShippingProvider');
const notificationService = require('./notificationService');
const { logAdminAction } = require('./adminAuditService');
const sellerWalletService = require('./sellerWalletService');

const providers = {
  mock: mockProvider
};

const createShipment = async (fulfillmentId, sellerId, providerName) => {
  const fulfillment = await Fulfillment.findOne({ _id: fulfillmentId, seller: sellerId });
  if (!fulfillment) {
    throw new ApiError(404, 'Fulfillment not found or access denied');
  }

  if (fulfillment.status !== 'READY_TO_SHIP') {
    throw new ApiError(400, `Cannot create shipment when fulfillment status is '${fulfillment.status}'`);
  }

  if (fulfillment.shipment) {
    throw new ApiError(409, 'Shipment already exists for this fulfillment');
  }

  const provider = providers[providerName];
  if (!provider) {
    throw new ApiError(400, `Unsupported shipping provider: ${providerName}`);
  }

  const order = await Order.findById(fulfillment.order);

  // Call provider adapter
  const providerResult = await provider.createShipment(fulfillment, order, sellerId);

  const shipment = await Shipment.create({
    fulfillment: fulfillment._id,
    order: order._id,
    seller: sellerId,
    provider: provider.name,
    awbNumber: providerResult.awbNumber,
    trackingNumber: providerResult.trackingNumber,
    trackingUrl: providerResult.trackingUrl,
    estimatedDeliveryDate: providerResult.estimatedDeliveryDate,
    status: 'SHIPPED',
    shippedAt: new Date()
  });

  fulfillment.shipment = shipment._id;
  fulfillment.status = 'SHIPPED';
  fulfillment.shippedAt = shipment.shippedAt;
  await fulfillment.save();

  // Fire notification
  setImmediate(async () => {
    try {
      // Create a deterministic key so duplicate shipped events don't spam
      await notificationService.notifyOrderShipped({
        order,
        userId: order.user,
        shipment
      });
    } catch (err) {
      console.error('[ShipmentService] Post-shipment notification error:', err.message);
    }
  });

  return shipment;
};

const getShipmentById = async (shipmentId) => {
  const shipment = await Shipment.findById(shipmentId)
    .populate('order', 'orderNumber orderStatus shippingAddress')
    .populate('seller', 'businessName')
    .populate('fulfillment');

  if (!shipment) {
    throw new ApiError(404, 'Shipment not found');
  }
  return shipment;
};

const transitionShipmentStatusByAdmin = async (adminId, shipmentId, newStatus, req) => {
  const validStatuses = ['SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELIVERY_FAILED', 'CANCELLED'];
  if (!validStatuses.includes(newStatus)) {
    throw new ApiError(400, `Invalid status. Allowed: ${validStatuses.join(', ')}`);
  }

  const shipment = await Shipment.findById(shipmentId).populate('fulfillment');
  if (!shipment) {
    throw new ApiError(404, 'Shipment not found');
  }

  const currentStatus = shipment.status;
  if (currentStatus === newStatus) {
    return shipment;
  }

  // Simple state transitions block backward flows
  const flow = {
    'SHIPPED': ['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
    'IN_TRANSIT': ['OUT_FOR_DELIVERY', 'DELIVERED', 'DELIVERY_FAILED'],
    'OUT_FOR_DELIVERY': ['DELIVERED', 'DELIVERY_FAILED'],
    'DELIVERY_FAILED': ['IN_TRANSIT'], // retry
    'DELIVERED': [],
    'CANCELLED': []
  };

  const allowed = flow[currentStatus] || [];
  if (!allowed.includes(newStatus)) {
    throw new ApiError(400, `Cannot transition shipment from '${currentStatus}' to '${newStatus}'`);
  }

  shipment.status = newStatus;
  const now = new Date();
  
  if (newStatus === 'DELIVERED') {
    shipment.deliveredAt = now;
  }

  await shipment.save();

  const fulfillment = await Fulfillment.findById(shipment.fulfillment._id);
  fulfillment.status = newStatus;
  if (newStatus === 'DELIVERED') {
    fulfillment.deliveredAt = now;
  }
  await fulfillment.save();

  if (newStatus === 'DELIVERED') {
    await sellerWalletService.settleSellerEarningIfEligible(shipment.order, fulfillment.seller);
  }

  // Audit
  await logAdminAction({
    adminId,
    action: 'SHIPMENT_STATUS_CHANGED',
    targetType: 'Order', // Since Shipment isn't in the enum, map to Order or System. AdminAuditLog has Order.
    targetId: shipment.order,
    metadata: { shipmentId, previousStatus: currentStatus, newStatus },
    req
  });

  // Evaluate Overall Order Status
  const allFulfillments = await Fulfillment.find({ order: shipment.order });
  const allDelivered = allFulfillments.every(f => f.status === 'DELIVERED');
  
  if (allDelivered) {
    const order = await Order.findById(shipment.order);
    if (order.orderStatus !== 'delivered' && order.orderStatus !== 'cancelled') {
      order.orderStatus = 'delivered';
      await order.save();

      setImmediate(async () => {
        try {
          await notificationService.notifyOrderDelivered({
            order,
            userId: order.user
          });
        } catch (err) {
          console.error('[ShipmentService] Order delivered notification error:', err.message);
        }
      });
    }
  } else if (newStatus === 'OUT_FOR_DELIVERY') {
    const order = await Order.findById(shipment.order);
    if (order.orderStatus !== 'out_of_delivery' && order.orderStatus !== 'delivered' && order.orderStatus !== 'cancelled') {
      order.orderStatus = 'out_of_delivery';
      await order.save();
    }
  }

  return shipment;
};

module.exports = {
  createShipment,
  getShipmentById,
  transitionShipmentStatusByAdmin
};
