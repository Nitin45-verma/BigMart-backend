const SellerPayout = require('../models/SellerPayout');
const sellerWalletService = require('../services/sellerWalletService');
const { logAdminAction } = require('../services/adminAuditService');
const ApiError = require('../utils/ApiError');

exports.listPayouts = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const query = {};
    if (req.query.status) query.status = req.query.status;
    if (req.query.sellerId) query.seller = req.query.sellerId;

    const payouts = await SellerPayout.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('seller', 'businessName user');

    const total = await SellerPayout.countDocuments(query);

    res.status(200).json({
      success: true,
      data: payouts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getPayout = async (req, res, next) => {
  try {
    const payout = await SellerPayout.findById(req.params.payoutId)
      .populate('seller', 'businessName user')
      .populate('reviewedBy', 'name email');

    if (!payout) {
      throw new ApiError(404, 'Payout not found');
    }

    res.status(200).json({
      success: true,
      data: payout
    });
  } catch (error) {
    next(error);
  }
};

exports.approvePayout = async (req, res, next) => {
  try {
    const payout = await sellerWalletService.approvePayout(req.params.payoutId, req.user._id);
    
    await logAdminAction({
      adminId: req.user._id,
      action: 'PAYOUT_APPROVED',
      targetType: 'SellerPayout',
      targetId: payout._id,
      req
    });

    res.status(200).json({
      success: true,
      message: 'Payout approved',
      data: payout
    });
  } catch (error) {
    next(error);
  }
};

exports.rejectPayout = async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason || reason.trim().length === 0) {
      throw new ApiError(400, 'Rejection reason is required');
    }
    const payout = await sellerWalletService.rejectPayout(req.params.payoutId, req.user._id, reason);
    
    await logAdminAction({
      adminId: req.user._id,
      action: 'PAYOUT_REJECTED',
      targetType: 'SellerPayout',
      targetId: payout._id,
      metadata: { reason },
      req
    });

    res.status(200).json({
      success: true,
      message: 'Payout rejected',
      data: payout
    });
  } catch (error) {
    next(error);
  }
};

exports.processPayout = async (req, res, next) => {
  try {
    const payout = await sellerWalletService.processPayout(req.params.payoutId, req.user._id);
    
    await logAdminAction({
      adminId: req.user._id,
      action: 'PAYOUT_PROCESSED',
      targetType: 'SellerPayout',
      targetId: payout._id,
      req
    });

    res.status(200).json({
      success: true,
      message: 'Payout moved to processing state',
      data: payout
    });
  } catch (error) {
    next(error);
  }
};

exports.completePayout = async (req, res, next) => {
  try {
    const { providerPayoutId } = req.body;
    const payout = await sellerWalletService.completePayout(req.params.payoutId, req.user._id, providerPayoutId);
    
    await logAdminAction({
      adminId: req.user._id,
      action: 'PAYOUT_COMPLETED',
      targetType: 'SellerPayout',
      targetId: payout._id,
      metadata: { providerPayoutId },
      req
    });

    res.status(200).json({
      success: true,
      message: 'Payout completed',
      data: payout
    });
  } catch (error) {
    next(error);
  }
};

exports.failPayout = async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason || reason.trim().length === 0) {
      throw new ApiError(400, 'Failure reason is required');
    }
    const payout = await sellerWalletService.failPayout(req.params.payoutId, req.user._id, reason);
    
    await logAdminAction({
      adminId: req.user._id,
      action: 'PAYOUT_FAILED',
      targetType: 'SellerPayout',
      targetId: payout._id,
      metadata: { reason },
      req
    });

    res.status(200).json({
      success: true,
      message: 'Payout marked as failed',
      data: payout
    });
  } catch (error) {
    next(error);
  }
};
