const Order = require('../models/Order');
const ApiError = require('../utils/ApiError');
const { logAdminAction } = require('./adminAuditService');
const notificationService = require('./notificationService');

/**
 * Valid order status state machine transitions map.
 */
const VALID_TRANSITIONS = {
  pending_payment: ['paid', 'cancelled'],
  paid: ['processing', 'shipped', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['out_of_delivery', 'delivered', 'cancelled'],
  out_of_delivery: ['delivered', 'cancelled'],
  delivered: [], // Terminal state
  cancelled: []  // Terminal state
};

/**
 * Returns paginated marketplace orders for admin overview & filtering.
 */
const getOrders = async ({ page = 1, limit = 20, search, paymentStatus, orderStatus, from, to, seller }) => {
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const query = {};

  if (paymentStatus) {
    query['payment.status'] = paymentStatus;
  }

  if (orderStatus) {
    query.orderStatus = orderStatus;
  }

  if (seller) {
    query['items.seller'] = seller;
  }

  if (search && typeof search === 'string' && search.trim().length > 0) {
    query.orderNumber = new RegExp(search.trim(), 'i');
  }

  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      if (typeof to === 'string' && to.length <= 10) {
        toDate.setUTCHours(23, 59, 59, 999);
      }
      query.createdAt.$lte = toDate;
    }
  }

  const [orders, total] = await Promise.all([
    Order.find(query)
      .populate('user', 'name email role')
      .populate('items.seller', 'businessName businessType')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Order.countDocuments(query)
  ]);

  return {
    orders,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum)
  };
};

/**
 * Returns detailed single order record for admin inspection.
 */
const getOrderById = async (orderId) => {
  const order = await Order.findById(orderId)
    .populate('user', 'name email role isEmailVerified')
    .populate('items.seller', 'businessName businessType verificationStatus')
    .lean();

  if (!order) {
    throw new ApiError(404, 'Order record not found');
  }

  return order;
};

/**
 * Updates operational order status using controlled state machine rules.
 * Preserves financial snapshots, payment status, and order item immutability.
 */
const updateOrderStatus = async (adminId, orderId, newOrderStatus, req) => {
  const validStatuses = ['pending_payment', 'paid', 'processing', 'shipped', 'out_of_delivery', 'delivered', 'cancelled'];
  if (!newOrderStatus || !validStatuses.includes(newOrderStatus)) {
    throw new ApiError(400, `Invalid order status '${newOrderStatus}'. Allowed: ${validStatuses.join(', ')}`);
  }

  const order = await Order.findById(orderId);
  if (!order) {
    throw new ApiError(404, 'Order record not found');
  }

  const currentStatus = order.orderStatus;
  if (currentStatus === newOrderStatus) {
    return {
      message: `Order status is already '${newOrderStatus}'`,
      order
    };
  }

  const allowedNextStatuses = VALID_TRANSITIONS[currentStatus] || [];
  if (!allowedNextStatuses.includes(newOrderStatus)) {
    throw new ApiError(
      400,
      `Cannot transition order status from '${currentStatus}' to '${newOrderStatus}'. Allowed transitions: [${allowedNextStatuses.join(', ')}]`
    );
  }

  // Preserve historical financial records completely - only update operational status
  order.orderStatus = newOrderStatus;
  await order.save();

  await logAdminAction({
    adminId,
    action: 'ORDER_STATUS_CHANGED',
    targetType: 'Order',
    targetId: orderId,
    metadata: {
      orderNumber: order.orderNumber,
      previousOrderStatus: currentStatus,
      newOrderStatus,
      paymentStatus: order.payment?.status
    },
    req
  });

  // Fire shipping/delivery notifications non-blocking after DB write
  setImmediate(async () => {
    try {
      if (newOrderStatus === 'shipped') {
        await notificationService.notifyOrderShipped({
          order,
          userId: order.user
        });
      } else if (newOrderStatus === 'delivered') {
        await notificationService.notifyOrderDelivered({
          order,
          userId: order.user
        });
      }
    } catch (notifErr) {
      console.error('[AdminOrderService] Notification fire failed:', notifErr.message);
    }
  });

  return {
    message: `Order #${order.orderNumber} status updated from '${currentStatus}' to '${newOrderStatus}'`,
    order
  };
};

module.exports = {
  getOrders,
  getOrderById,
  updateOrderStatus
};
