const adminOrderService = require('../services/adminOrderService');

const getOrders = async (req, res, next) => {
  try {
    const result = await adminOrderService.getOrders(req.query);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const getOrderById = async (req, res, next) => {
  try {
    const order = await adminOrderService.getOrderById(req.params.orderId);
    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
};

const updateOrderStatus = async (req, res, next) => {
  try {
    const result = await adminOrderService.updateOrderStatus(
      req.user.userId,
      req.params.orderId,
      req.body.orderStatus,
      req
    );
    res.status(200).json({
      success: true,
      message: result.message,
      data: result.order
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getOrders,
  getOrderById,
  updateOrderStatus
};
