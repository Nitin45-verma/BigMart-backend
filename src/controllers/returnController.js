const returnService = require('../services/returnService');

/**
 * Customer: Submit return request
 */
const createReturnRequest = async (req, res, next) => {
  try {
    const { items, reason, description } = req.body;
    const result = await returnService.createReturnRequest(
      req.user.userId,
      req.params.orderId,
      { items, reason, description }
    );
    res.status(201).json({
      success: true,
      message: 'Return request submitted successfully',
      data: { returnRequest: result }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Customer: List own return requests
 */
const getCustomerReturns = async (req, res, next) => {
  try {
    const { page, limit, status } = req.query;
    const result = await returnService.getCustomerReturns(req.user.userId, {
      page,
      limit,
      status
    });
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Customer: Get return request by ID
 */
const getCustomerReturnById = async (req, res, next) => {
  try {
    const returnReq = await returnService.getCustomerReturnById(
      req.user.userId,
      req.params.returnId
    );
    res.status(200).json({
      success: true,
      data: { returnRequest: returnReq }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Seller: List return requests for authenticated seller
 */
const getSellerReturns = async (req, res, next) => {
  try {
    const { page, limit, status } = req.query;
    const result = await returnService.getSellerReturns(req.seller._id, {
      page,
      limit,
      status
    });
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Seller: Get single return request by ID
 */
const getSellerReturnById = async (req, res, next) => {
  try {
    const returnReq = await returnService.getSellerReturnById(
      req.seller._id,
      req.params.returnId
    );
    res.status(200).json({
      success: true,
      data: { returnRequest: returnReq }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Seller: Approve return request
 */
const approveSellerReturn = async (req, res, next) => {
  try {
    const returnReq = await returnService.approveSellerReturn(
      req.seller._id,
      req.params.returnId,
      req.user.userId
    );
    res.status(200).json({
      success: true,
      message: 'Return request approved successfully',
      data: { returnRequest: returnReq }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Seller: Reject return request
 */
const rejectSellerReturn = async (req, res, next) => {
  try {
    const { rejectionReason } = req.body;
    const returnReq = await returnService.rejectSellerReturn(
      req.seller._id,
      req.params.returnId,
      req.user.userId,
      rejectionReason
    );
    res.status(200).json({
      success: true,
      message: 'Return request rejected successfully',
      data: { returnRequest: returnReq }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: List all return requests
 */
const getAdminReturns = async (req, res, next) => {
  try {
    const { page, limit, status, sellerId, customerId } = req.query;
    const result = await returnService.getAdminReturns({
      page,
      limit,
      status,
      sellerId,
      customerId
    });
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Get return request by ID
 */
const getAdminReturnById = async (req, res, next) => {
  try {
    const returnReq = await returnService.getAdminReturnById(req.params.returnId);
    res.status(200).json({
      success: true,
      data: { returnRequest: returnReq }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Approve return request
 */
const approveAdminReturn = async (req, res, next) => {
  try {
    const returnReq = await returnService.approveAdminReturn(
      req.user.userId,
      req.params.returnId
    );
    res.status(200).json({
      success: true,
      message: 'Return request approved by admin',
      data: { returnRequest: returnReq }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Reject return request
 */
const rejectAdminReturn = async (req, res, next) => {
  try {
    const { rejectionReason } = req.body;
    const returnReq = await returnService.rejectAdminReturn(
      req.user.userId,
      req.params.returnId,
      rejectionReason
    );
    res.status(200).json({
      success: true,
      message: 'Return request rejected by admin',
      data: { returnRequest: returnReq }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Process refund
 */
const processRefund = async (req, res, next) => {
  try {
    const result = await returnService.processRefund(
      req.user.userId,
      req.params.returnId
    );
    res.status(200).json({
      success: true,
      message: result.message,
      data: { returnRequest: result.returnRequest }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createReturnRequest,
  getCustomerReturns,
  getCustomerReturnById,
  getSellerReturns,
  getSellerReturnById,
  approveSellerReturn,
  rejectSellerReturn,
  getAdminReturns,
  getAdminReturnById,
  approveAdminReturn,
  rejectAdminReturn,
  processRefund
};
