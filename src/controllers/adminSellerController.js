const adminSellerService = require('../services/adminSellerService');

const getSellers = async (req, res, next) => {
  try {
    const result = await adminSellerService.getSellers(req.query);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const getSellerById = async (req, res, next) => {
  try {
    const data = await adminSellerService.getSellerById(req.params.sellerId);
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

const blockSeller = async (req, res, next) => {
  try {
    const result = await adminSellerService.blockSeller(req.user.userId, req.params.sellerId, req);
    res.status(200).json({
      success: true,
      message: result.message,
      data: result.seller
    });
  } catch (error) {
    next(error);
  }
};

const unblockSeller = async (req, res, next) => {
  try {
    const result = await adminSellerService.unblockSeller(req.user.userId, req.params.sellerId, req);
    res.status(200).json({
      success: true,
      message: result.message,
      data: result.seller
    });
  } catch (error) {
    next(error);
  }
};

const suspendSeller = async (req, res, next) => {
  try {
    const result = await adminSellerService.suspendSeller(
      req.user.userId,
      req.params.sellerId,
      req.body.reason,
      req
    );
    res.status(200).json({
      success: true,
      message: result.message,
      data: result.seller
    });
  } catch (error) {
    next(error);
  }
};

const reactivateSeller = async (req, res, next) => {
  try {
    const result = await adminSellerService.reactivateSeller(
      req.user.userId,
      req.params.sellerId,
      req
    );
    res.status(200).json({
      success: true,
      message: result.message,
      data: result.seller
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSellers,
  getSellerById,
  blockSeller,
  unblockSeller,
  suspendSeller,
  reactivateSeller
};
