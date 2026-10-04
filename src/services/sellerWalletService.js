const mongoose = require('mongoose');
const SellerWallet = require('../models/SellerWallet');
const SellerWalletTransaction = require('../models/SellerWalletTransaction');
const SellerPayout = require('../models/SellerPayout');
const Seller = require('../models/Seller');
const PlatformFeeConfig = require('../models/PlatformFeeConfig');
const Order = require('../models/Order');
const ReturnRequest = require('../models/ReturnRequest');
const { roundMoney } = require('../utils/moneyUtils');
const ApiError = require('../utils/ApiError');
const notificationService = require('./notificationService');

/**
 * Helper: run an async callback with a Mongoose session if the connection
 * supports transactions (replica set). Falls back to no-session on standalone.
 *
 * Usage:
 *   const result = await withSession(async (session) => { ... });
 */
const withSession = async (fn) => {
  let session = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
    const result = await fn(session);
    await session.commitTransaction();
    return result;
  } catch (err) {
    if (session) {
      try { await session.abortTransaction(); } catch (_) {}
    }
    // If the error is "Transaction numbers are only allowed on a replica set",
    // retry without a transaction session.
    if (err.code === 20 || (err.message && err.message.includes('Transaction numbers'))) {
      return await fn(null);
    }
    throw err;
  } finally {
    if (session) {
      try { session.endSession(); } catch (_) {}
    }
  }
};

const getOrCreateSellerWallet = async (sellerId, session = null) => {
  let wallet = session
    ? await SellerWallet.findOne({ seller: sellerId }).session(session)
    : await SellerWallet.findOne({ seller: sellerId });

  if (!wallet) {
    if (session) {
      const created = await SellerWallet.create([{ seller: sellerId }], { session });
      wallet = created[0];
    } else {
      wallet = await SellerWallet.create({ seller: sellerId });
    }
  }
  return wallet;
};

const getPlatformFeeRate = async (seller) => {
  if (seller && seller.platformFeeRate !== undefined && seller.platformFeeRate !== null) {
    return seller.platformFeeRate;
  }
  if (seller && seller.businessType) {
    const config = await PlatformFeeConfig.findOne({ businessType: seller.businessType });
    if (config) {
      return config.rate;
    }
  }
  // Try global default
  const globalConfig = await PlatformFeeConfig.findOne({}).sort({ createdAt: 1 });
  if (globalConfig) return globalConfig.rate;
  return 0; // Default 0 if none found
};

const creditOrderEarnings = async (orderId) => {
  const order = await Order.findById(orderId).populate('items.seller');
  if (!order) return;

  const sellers = new Set();
  order.items.forEach(item => {
    if (item.seller) sellers.add(item.seller._id ? item.seller._id.toString() : item.seller.toString());
  });

  for (const sellerId of sellers) {
    const idempotencyKey = `ORDER_EARNING:${orderId}:${sellerId}`;

    // Check if transaction already exists (idempotency check outside session to support standalone)
    const existingTx = await SellerWalletTransaction.findOne({ idempotencyKey });
    if (existingTx) {
      throw new ApiError(409, `Earnings already credited for order ${orderId} seller ${sellerId}`);
    }

    await withSession(async (session) => {
      const wallet = await getOrCreateSellerWallet(sellerId, session);

      // Calculate gross items total for this seller
      const sellerItems = order.items.filter(i =>
        (i.seller._id ? i.seller._id.toString() : i.seller.toString()) === sellerId
      );
      const itemsTotal = sellerItems.reduce((sum, item) => sum + (item.itemTotal || (item.unitPrice * item.quantity)), 0);

      // Delivery fee (per-seller shipping)
      let deliveryFee = 0;
      if (order.shipping && order.shipping.sellers) {
        const sellerShipping = order.shipping.sellers.find(s => s.seller.toString() === sellerId);
        if (sellerShipping) {
          deliveryFee = sellerShipping.deliveryFee;
        }
      } else if (order.shippingFee && sellers.size === 1) {
        // Single seller: assign entire shipping fee
        deliveryFee = order.shippingFee || 0;
      }

      const grossEarnings = roundMoney(itemsTotal + deliveryFee);

      const sellerDoc = session
        ? await Seller.findById(sellerId).session(session)
        : await Seller.findById(sellerId);
      const feeRate = await getPlatformFeeRate(sellerDoc);

      const platformFee = roundMoney(grossEarnings * feeRate);
      const netEarnings = roundMoney(grossEarnings - platformFee);

      const createOpts = session ? { session } : {};

      // 1. ORDER_EARNING
      await SellerWalletTransaction.create([{
        seller: sellerId,
        wallet: wallet._id,
        type: 'ORDER_EARNING',
        direction: 'credit',
        amount: grossEarnings,
        balanceBefore: wallet.pendingBalance,
        balanceAfter: roundMoney(wallet.pendingBalance + grossEarnings),
        balanceType: 'pending',
        order: orderId,
        idempotencyKey: idempotencyKey,
        description: `Earning from order ${order.orderNumber}`
      }], createOpts);

      wallet.pendingBalance = roundMoney(wallet.pendingBalance + grossEarnings);
      wallet.totalEarned = roundMoney(wallet.totalEarned + grossEarnings);

      // 2. PLATFORM_FEE
      if (platformFee > 0) {
        await SellerWalletTransaction.create([{
          seller: sellerId,
          wallet: wallet._id,
          type: 'PLATFORM_FEE',
          direction: 'debit',
          amount: platformFee,
          balanceBefore: wallet.pendingBalance,
          balanceAfter: roundMoney(wallet.pendingBalance - platformFee),
          balanceType: 'pending',
          order: orderId,
          idempotencyKey: `PLATFORM_FEE:${orderId}:${sellerId}`,
          description: `Platform fee for order ${order.orderNumber}`
        }], createOpts);
        wallet.pendingBalance = roundMoney(wallet.pendingBalance - platformFee);
        wallet.totalPlatformFees = roundMoney(wallet.totalPlatformFees + platformFee);
      }

      if (session) {
        await wallet.save({ session });
      } else {
        await wallet.save();
      }
    });
  }
};

const settleSellerEarningIfEligible = async (orderId, sellerId) => {
  const order = await Order.findById(orderId);
  if (!order || order.orderStatus === 'cancelled') return;

  const idempotencyKey = `SETTLEMENT_AVAILABLE:${orderId}:${sellerId}`;

  // Pre-check idempotency (works on standalone)
  const existingTx = await SellerWalletTransaction.findOne({ idempotencyKey });
  if (existingTx) {
    throw new ApiError(409, `Earnings already settled for order ${orderId} seller ${sellerId}`);
  }

  await withSession(async (session) => {
    const earningTx = session
      ? await SellerWalletTransaction.findOne({ order: orderId, seller: sellerId, type: 'ORDER_EARNING' }).session(session)
      : await SellerWalletTransaction.findOne({ order: orderId, seller: sellerId, type: 'ORDER_EARNING' });

    if (!earningTx) return;

    const feeTx = session
      ? await SellerWalletTransaction.findOne({ order: orderId, seller: sellerId, type: 'PLATFORM_FEE' }).session(session)
      : await SellerWalletTransaction.findOne({ order: orderId, seller: sellerId, type: 'PLATFORM_FEE' });

    const grossEarning = earningTx.amount;
    const platformFee = feeTx ? feeTx.amount : 0;
    const netEarning = roundMoney(grossEarning - platformFee);

    const wallet = await getOrCreateSellerWallet(sellerId, session);

    wallet.pendingBalance = roundMoney(wallet.pendingBalance - netEarning);
    wallet.availableBalance = roundMoney(wallet.availableBalance + netEarning);

    const createOpts = session ? { session } : {};

    await SellerWalletTransaction.create([{
      seller: sellerId,
      wallet: wallet._id,
      type: 'SETTLEMENT_AVAILABLE',
      direction: 'transfer',
      amount: netEarning,
      balanceBefore: roundMoney(wallet.availableBalance - netEarning),
      balanceAfter: wallet.availableBalance,
      balanceType: 'available',
      order: orderId,
      idempotencyKey: idempotencyKey,
      description: `Settled earnings for order ${order.orderNumber}`
    }], createOpts);

    if (session) {
      await wallet.save({ session });
    } else {
      await wallet.save();
    }
  });
};

/**
 * @param {string} sellerId
 * @param {string} orderId
 * @param {number} refundAmount  - gross refund amount
 * @param {number} [platformFeeRefunded=0] - the portion of platform fee to also restore
 * @param {string|null} [returnRequestId]
 * @param {string|null} [idempotencyKeyOverride]
 */
const debitRefundAmount = async (sellerId, orderId, refundAmount, platformFeeRefunded = 0, returnRequestId = null, idempotencyKeyOverride = null) => {
  const netDebit = roundMoney(refundAmount - platformFeeRefunded);

  const key = idempotencyKeyOverride || `REFUND_DEBIT:${orderId}:${sellerId}:${returnRequestId || Date.now()}`;

  await withSession(async (session) => {
    if (session) {
      const existingTx = await SellerWalletTransaction.findOne({ idempotencyKey: key }).session(session);
      if (existingTx) return;
    }

    const wallet = await getOrCreateSellerWallet(sellerId, session);

    let balanceType = 'available';
    let balanceBefore = wallet.availableBalance;

    if (wallet.pendingBalance >= netDebit) {
      balanceType = 'pending';
      balanceBefore = wallet.pendingBalance;
      wallet.pendingBalance = roundMoney(wallet.pendingBalance - netDebit);
    } else {
      wallet.availableBalance = roundMoney(wallet.availableBalance - netDebit);
    }

    wallet.totalRefunded = roundMoney(wallet.totalRefunded + netDebit);

    const balanceAfter = balanceType === 'pending' ? wallet.pendingBalance : wallet.availableBalance;

    const createOpts = session ? { session } : {};

    await SellerWalletTransaction.create([{
      seller: sellerId,
      wallet: wallet._id,
      type: 'REFUND_DEBIT',
      direction: 'debit',
      amount: netDebit,
      balanceBefore,
      balanceAfter,
      balanceType,
      order: orderId,
      returnRequest: returnRequestId,
      idempotencyKey: key,
      description: `Refund debit for order`
    }], createOpts);

    if (session) {
      await wallet.save({ session });
    } else {
      await wallet.save();
    }
  });
};

const debitCancellationAmount = async (orderId, sellerId) => {
  const order = await Order.findById(orderId);
  if (!order) return;

  await withSession(async (session) => {
    const idempotencyKey = `CANCELLATION_DEBIT:${orderId}:${sellerId}`;
    if (session) {
      const existingTx = await SellerWalletTransaction.findOne({ idempotencyKey }).session(session);
      if (existingTx) return;
    } else {
      const existingTx = await SellerWalletTransaction.findOne({ idempotencyKey });
      if (existingTx) return;
    }

    const earningTx = session
      ? await SellerWalletTransaction.findOne({ order: orderId, seller: sellerId, type: 'ORDER_EARNING' }).session(session)
      : await SellerWalletTransaction.findOne({ order: orderId, seller: sellerId, type: 'ORDER_EARNING' });

    if (!earningTx) return;

    const feeTx = session
      ? await SellerWalletTransaction.findOne({ order: orderId, seller: sellerId, type: 'PLATFORM_FEE' }).session(session)
      : await SellerWalletTransaction.findOne({ order: orderId, seller: sellerId, type: 'PLATFORM_FEE' });

    const grossEarning = earningTx.amount;
    const platformFee = feeTx ? feeTx.amount : 0;

    const wallet = await getOrCreateSellerWallet(sellerId, session);

    wallet.pendingBalance = roundMoney(wallet.pendingBalance - grossEarning + platformFee);
    wallet.totalEarned = roundMoney(wallet.totalEarned - grossEarning);
    wallet.totalPlatformFees = roundMoney(wallet.totalPlatformFees - platformFee);

    const createOpts = session ? { session } : {};

    await SellerWalletTransaction.create([{
      seller: sellerId,
      wallet: wallet._id,
      type: 'CANCELLATION_DEBIT',
      direction: 'debit',
      amount: roundMoney(grossEarning - platformFee),
      balanceBefore: roundMoney(wallet.pendingBalance + grossEarning - platformFee),
      balanceAfter: wallet.pendingBalance,
      balanceType: 'pending',
      order: orderId,
      idempotencyKey: idempotencyKey,
      description: `Cancellation debit for order ${order.orderNumber}`
    }], createOpts);

    if (session) {
      await wallet.save({ session });
    } else {
      await wallet.save();
    }
  });
};

/**
 * Request a payout.
 * @param {string} sellerId
 * @param {number} amount
 * @param {object} [bankDetailsOverride] - if provided, use these bank details instead of reading from Seller doc
 */
const requestPayout = async (sellerId, amount, bankDetailsOverride = null) => {
  amount = roundMoney(amount);
  if (amount <= 0) throw new ApiError(400, 'Amount must be greater than zero');

  let payout;

  await withSession(async (session) => {
    const wallet = session
      ? await getOrCreateSellerWallet(sellerId, session)
      : await getOrCreateSellerWallet(sellerId);

    if (wallet.status !== 'active') {
      throw new ApiError(403, 'Wallet is frozen or suspended');
    }

    if (wallet.availableBalance < amount) {
      throw new ApiError(400, 'Insufficient available balance');
    }

    let bankAccountSnapshot;

    if (bankDetailsOverride) {
      // Use provided bank details (for testing or API requests that pass them explicitly)
      const acctStr = (bankDetailsOverride.accountNumber || '').toString();
      const masked = acctStr.length > 4 ? '*'.repeat(acctStr.length - 4) + acctStr.slice(-4) : '****';
      bankAccountSnapshot = {
        accountHolderName: bankDetailsOverride.accountHolderName || '',
        accountNumberMasked: masked,
        ifscCode: bankDetailsOverride.ifscCode || '',
        bankName: bankDetailsOverride.bankName || ''
      };
    } else {
      const seller = session
        ? await Seller.findById(sellerId).select('+bankDetails').session(session)
        : await Seller.findById(sellerId).select('+bankDetails');
      if (!seller || !seller.bankDetails || !seller.bankDetails.accountNumber) {
        throw new ApiError(400, 'Seller bank details not configured');
      }
      const acctStr = seller.bankDetails.accountNumber.toString();
      const masked = acctStr.length > 4 ? '*'.repeat(acctStr.length - 4) + acctStr.slice(-4) : '****';
      bankAccountSnapshot = {
        accountHolderName: seller.bankDetails.accountHolderName,
        accountNumberMasked: masked,
        ifscCode: seller.bankDetails.ifscCode,
        bankName: seller.bankDetails.bankName
      };
    }

    wallet.availableBalance = roundMoney(wallet.availableBalance - amount);

    const createOpts = session ? { session } : {};

    const payoutData = [{
      seller: sellerId,
      wallet: wallet._id,
      amount,
      bankAccountSnapshot,
      status: 'REQUESTED'
    }];

    const created = await SellerPayout.create(payoutData, createOpts);
    payout = created[0];

    const idempotencyKey = `PAYOUT_REQUEST:${payout._id}`;
    await SellerWalletTransaction.create([{
      seller: sellerId,
      wallet: wallet._id,
      type: 'PAYOUT_REQUEST',
      direction: 'debit',
      amount: amount,
      balanceBefore: roundMoney(wallet.availableBalance + amount),
      balanceAfter: wallet.availableBalance,
      balanceType: 'available',
      payout: payout._id,
      idempotencyKey,
      description: `Payout requested`
    }], createOpts);

    if (session) {
      await wallet.save({ session });
    } else {
      await wallet.save();
    }
  });

  // Notify
  setImmediate(async () => {
    try {
      await notificationService.notifyPayoutRequested({ payout, sellerId });
    } catch(err) {}
  });

  return payout;
};

const approvePayout = async (payoutId, adminId) => {
  const payout = await SellerPayout.findById(payoutId);
  if (!payout) throw new ApiError(404, 'Payout not found');
  if (payout.status !== 'REQUESTED') throw new ApiError(400, 'Payout is not in REQUESTED state');

  payout.status = 'APPROVED';
  payout.reviewedAt = Date.now();
  payout.reviewedBy = adminId;
  await payout.save();

  setImmediate(async () => {
    try {
      await notificationService.notifyPayoutApproved({ payout, sellerId: payout.seller });
    } catch(err) {}
  });
  return payout;
};

const rejectPayout = async (payoutId, adminId, reason) => {
  let payout;

  await withSession(async (session) => {
    payout = session
      ? await SellerPayout.findById(payoutId).session(session)
      : await SellerPayout.findById(payoutId);

    if (!payout) throw new ApiError(404, 'Payout not found');
    if (payout.status !== 'REQUESTED' && payout.status !== 'APPROVED') {
      throw new ApiError(400, 'Payout cannot be rejected from its current state');
    }

    payout.status = 'REJECTED';
    payout.rejectionReason = reason;
    payout.reviewedAt = Date.now();
    payout.reviewedBy = adminId;

    if (session) {
      await payout.save({ session });
    } else {
      await payout.save();
    }

    const wallet = await getOrCreateSellerWallet(payout.seller, session);
    wallet.availableBalance = roundMoney(wallet.availableBalance + payout.amount);

    const idempotencyKey = `PAYOUT_REVERSED:${payout._id}`;
    const createOpts = session ? { session } : {};

    await SellerWalletTransaction.create([{
      seller: payout.seller,
      wallet: wallet._id,
      type: 'PAYOUT_REVERSED',
      direction: 'credit',
      amount: payout.amount,
      balanceBefore: roundMoney(wallet.availableBalance - payout.amount),
      balanceAfter: wallet.availableBalance,
      balanceType: 'available',
      payout: payout._id,
      idempotencyKey,
      description: `Payout rejected, funds restored`
    }], createOpts);

    if (session) {
      await wallet.save({ session });
    } else {
      await wallet.save();
    }
  });

  setImmediate(async () => {
    try {
      await notificationService.notifyPayoutRejected({ payout, sellerId: payout.seller });
    } catch(err) {}
  });
  return payout;
};

const processPayout = async (payoutId, adminId) => {
  const payout = await SellerPayout.findById(payoutId);
  if (!payout) throw new ApiError(404, 'Payout not found');
  if (payout.status !== 'APPROVED') throw new ApiError(400, 'Payout is not in APPROVED state');

  payout.status = 'PROCESSING';
  await payout.save();

  return payout;
};

const completePayout = async (payoutId, adminId, providerPayoutId) => {
  let payout;

  await withSession(async (session) => {
    payout = session
      ? await SellerPayout.findById(payoutId).session(session)
      : await SellerPayout.findById(payoutId);

    if (!payout) throw new ApiError(404, 'Payout not found');
    if (payout.status !== 'PROCESSING' && payout.status !== 'APPROVED') {
      throw new ApiError(400, 'Payout cannot be completed from its current state');
    }

    payout.status = 'COMPLETED';
    payout.processedAt = Date.now();
    payout.providerPayoutId = providerPayoutId;

    if (session) {
      await payout.save({ session });
    } else {
      await payout.save();
    }

    const wallet = await getOrCreateSellerWallet(payout.seller, session);
    wallet.totalWithdrawn = roundMoney(wallet.totalWithdrawn + payout.amount);

    const idempotencyKey = `PAYOUT_COMPLETED:${payout._id}`;
    const createOpts = session ? { session } : {};

    await SellerWalletTransaction.create([{
      seller: payout.seller,
      wallet: wallet._id,
      type: 'PAYOUT_COMPLETED',
      direction: 'transfer',
      amount: payout.amount,
      balanceBefore: wallet.availableBalance,
      balanceAfter: wallet.availableBalance,
      balanceType: 'available',
      payout: payout._id,
      idempotencyKey,
      description: `Payout completed successfully`
    }], createOpts);

    if (session) {
      await wallet.save({ session });
    } else {
      await wallet.save();
    }
  });

  setImmediate(async () => {
    try {
      await notificationService.notifyPayoutCompleted({ payout, sellerId: payout.seller });
    } catch(err) {}
  });
  return payout;
};

const failPayout = async (payoutId, adminId, reason) => {
  let payout;

  await withSession(async (session) => {
    payout = session
      ? await SellerPayout.findById(payoutId).session(session)
      : await SellerPayout.findById(payoutId);

    if (!payout) throw new ApiError(404, 'Payout not found');
    if (payout.status !== 'PROCESSING' && payout.status !== 'APPROVED') {
      throw new ApiError(400, 'Payout cannot be failed from its current state');
    }

    payout.status = 'FAILED';
    payout.failureReason = reason;
    payout.processedAt = Date.now();

    if (session) {
      await payout.save({ session });
    } else {
      await payout.save();
    }

    const wallet = await getOrCreateSellerWallet(payout.seller, session);
    wallet.availableBalance = roundMoney(wallet.availableBalance + payout.amount);

    const idempotencyKey = `PAYOUT_FAILED:${payout._id}`;
    const createOpts = session ? { session } : {};

    await SellerWalletTransaction.create([{
      seller: payout.seller,
      wallet: wallet._id,
      type: 'PAYOUT_FAILED',
      direction: 'credit',
      amount: payout.amount,
      balanceBefore: roundMoney(wallet.availableBalance - payout.amount),
      balanceAfter: wallet.availableBalance,
      balanceType: 'available',
      payout: payout._id,
      idempotencyKey,
      description: `Payout failed: ${reason}`
    }], createOpts);

    if (session) {
      await wallet.save({ session });
    } else {
      await wallet.save();
    }
  });

  setImmediate(async () => {
    try {
      await notificationService.notifyPayoutFailed({ payout, sellerId: payout.seller });
    } catch(err) {}
  });
  return payout;
};

const getWalletSummary = async (sellerId) => {
  const wallet = await getOrCreateSellerWallet(sellerId);
  return wallet;
};

module.exports = {
  getOrCreateSellerWallet,
  creditOrderEarnings,
  settleSellerEarningIfEligible,
  debitRefundAmount,
  debitCancellationAmount,
  requestPayout,
  approvePayout,
  rejectPayout,
  processPayout,
  completePayout,
  failPayout,
  getWalletSummary
};
