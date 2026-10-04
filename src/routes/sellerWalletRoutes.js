const express = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { authorizeSeller } = require('../middleware/sellerMiddleware');
const sellerWalletService = require('../services/sellerWalletService');
const SellerWalletTransaction = require('../models/SellerWalletTransaction');
const SellerPayout = require('../models/SellerPayout');
const ApiError = require('../utils/ApiError');

const router = express.Router();

router.use(authenticate, authorizeRoles('seller'), authorizeSeller);

// GET /api/v1/seller/wallet
router.get('/', async (req, res, next) => {
  try {
    const wallet = await sellerWalletService.getWalletSummary(req.user.sellerId);
    res.status(200).json({
      success: true,
      data: wallet
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/seller/wallet/transactions
router.get('/transactions', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const query = { seller: req.user.sellerId };
    if (req.query.type) {
      query.type = req.query.type;
    }

    const transactions = await SellerWalletTransaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('order', 'orderNumber grandTotal')
      .populate('payout', 'status amount providerPayoutId');

    const total = await SellerWalletTransaction.countDocuments(query);

    res.status(200).json({
      success: true,
      data: transactions,
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
});

// GET /api/v1/seller/wallet/transactions/:transactionId
router.get('/transactions/:transactionId', async (req, res, next) => {
  try {
    const transaction = await SellerWalletTransaction.findOne({
      _id: req.params.transactionId,
      seller: req.user.sellerId
    })
      .populate('order', 'orderNumber grandTotal')
      .populate('payout');

    if (!transaction) {
      throw new ApiError(404, 'Transaction not found');
    }

    res.status(200).json({
      success: true,
      data: transaction
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/seller/wallet/payouts
router.get('/payouts', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const query = { seller: req.user.sellerId };
    if (req.query.status) {
      query.status = req.query.status;
    }

    const payouts = await SellerPayout.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

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
});

// GET /api/v1/seller/wallet/payouts/:payoutId
router.get('/payouts/:payoutId', async (req, res, next) => {
  try {
    const payout = await SellerPayout.findOne({
      _id: req.params.payoutId,
      seller: req.user.sellerId
    });

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
});

// POST /api/v1/seller/wallet/payouts
router.post('/payouts', async (req, res, next) => {
  try {
    const { amount } = req.body;
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      throw new ApiError(400, 'Invalid payout amount');
    }

    // Protection against excessive decimal precision
    const { roundMoney } = require('../utils/moneyUtils');
    if (roundMoney(numAmount) !== numAmount) {
      throw new ApiError(400, 'Amount has excessive decimal precision');
    }

    const payout = await sellerWalletService.requestPayout(req.user.sellerId, numAmount);

    res.status(201).json({
      success: true,
      message: 'Payout requested successfully',
      data: payout
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
