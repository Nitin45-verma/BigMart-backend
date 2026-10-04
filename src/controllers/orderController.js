const orderService = require('../services/orderService');

/**
 * Customer: Create order (checkout)
 */
const createOrder = async (req, res, next) => {
  try {
    const { addressId, couponCode } = req.body;
    const result = await orderService.createOrder(req.user.userId, addressId, couponCode);
    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Customer: List own orders
 */
const getUserOrders = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await orderService.getUserOrders(req.user.userId, { page, limit });
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Customer: Get order details by ID
 */
const getOrderById = async (req, res, next) => {
  try {
    const order = await orderService.getOrderById(req.user.userId, req.params.orderId);
    res.status(200).json({
      success: true,
      data: { order }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Customer: Cancel order
 */
const cancelOrder = async (req, res, next) => {
  try {
    const returnService = require('../services/returnService');
    const { reason } = req.body;
    const result = await returnService.cancelOrder(req.user.userId, req.params.orderId, reason);
    res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOrder,
  getUserOrders,
  getOrderById,
  cancelOrder
};

