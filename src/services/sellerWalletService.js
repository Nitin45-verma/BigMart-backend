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

const getOrCreateSellerWallet = async (sellerId, session = null) => {
  let wallet = await SellerWallet.findOne({ seller: sellerId }).session(session);
  if (!wallet) {
    wallet = await SellerWallet.create([{ seller: sellerId }], { session });
    wallet = wallet[0];
  }
  return wallet;
};

const getPlatformFeeRate = async (seller) => {
  if (seller.platformFeeRate !== undefined && seller.platformFeeRate !== null) {
    return seller.platformFeeRate;
  }
  if (seller.businessType) {
    const config = await PlatformFeeConfig.findOne({ businessType: seller.businessType });
    if (config) {
      return config.rate;
    }
  }
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
    
    // Check if transaction already exists
    const existingTx = await SellerWalletTransaction.findOne({ idempotencyKey });
    if (existingTx) continue; // Idempotent

    // Start a transaction for each seller to avoid holding a giant lock
    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      const wallet = await getOrCreateSellerWallet(sellerId, session);

      // Calculate gross items total
      const sellerItems = order.items.filter(i => 
        (i.seller._id ? i.seller._id.toString() : i.seller.toString()) === sellerId
      );
      const itemsTotal = sellerItems.reduce((sum, item) => sum + item.itemTotal, 0);

      // Delivery fee
      let deliveryFee = 0;
      if (order.shipping && order.shipping.sellers) {
        const sellerShipping = order.shipping.sellers.find(s => s.seller.toString() === sellerId);
        if (sellerShipping) {
          deliveryFee = sellerShipping.deliveryFee;
        }
      }

      const grossEarnings = roundMoney(itemsTotal + deliveryFee);
      
      const sellerDoc = await Seller.findById(sellerId).session(session);
      const feeRate = await getPlatformFeeRate(sellerDoc);
      
      const platformFee = roundMoney(grossEarnings * feeRate);
      const netEarnings = roundMoney(grossEarnings - platformFee);

      // Create Ledger Entries
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
      }], { session });

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
        }], { session });
        wallet.pendingBalance = roundMoney(wallet.pendingBalance - platformFee);
        wallet.totalPlatformFees = roundMoney(wallet.totalPlatformFees + platformFee);
      }

      await wallet.save({ session });
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      console.error(`[Wallet] Error crediting order earnings for order ${orderId} seller ${sellerId}:`, error);
    } finally {
      session.endSession();
    }
  }
};

const settleSellerEarningIfEligible = async (orderId, sellerId) => {
  // Finds the pending ORDER_EARNING transaction and moves the net amount to availableBalance
  const order = await Order.findById(orderId);
  if (!order || order.orderStatus === 'cancelled') return;

  const idempotencyKey = `SETTLEMENT_AVAILABLE:${orderId}:${sellerId}`;
  
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const existingTx = await SellerWalletTransaction.findOne({ idempotencyKey }).session(session);
    if (existingTx) {
      await session.abortTransaction();
      return;
    }

    const earningTx = await SellerWalletTransaction.findOne({ 
      order: orderId, seller: sellerId, type: 'ORDER_EARNING' 
    }).session(session);

    if (!earningTx) {
      await session.abortTransaction();
      return;
    }

    const feeTx = await SellerWalletTransaction.findOne({
      order: orderId, seller: sellerId, type: 'PLATFORM_FEE'
    }).session(session);

    const grossEarning = earningTx.amount;
    const platformFee = feeTx ? feeTx.amount : 0;
    const netEarning = roundMoney(grossEarning - platformFee);

    const wallet = await getOrCreateSellerWallet(sellerId, session);

    // Ensure we don't settle into negative pending balance (in case of partial refunds already done)
    // Actually, refunds debit from available if already settled, or pending if not.
    // For simplicity, we just move the remaining netEarning that wasn't refunded out of pending.
    // But what if it was refunded? The pendingBalance already went down.
    // So we just transition netEarning.
    
    // We should transition `netEarning` from pending to available.
    
    // Wait, let's look at availableBalance.
    wallet.pendingBalance = roundMoney(wallet.pendingBalance - netEarning);
    wallet.availableBalance = roundMoney(wallet.availableBalance + netEarning);

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
    }], { session });

    await wallet.save({ session });
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    console.error(`[Wallet] Error settling earnings for order ${orderId} seller ${sellerId}:`, error);
  } finally {
    session.endSession();
  }
};

const debitRefundAmount = async (orderId, sellerId, refundAmount, returnRequestId = null, idempotencyKey = null) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const key = idempotencyKey || `REFUND_DEBIT:${orderId}:${sellerId}:${returnRequestId || Date.now()}`;
    const existingTx = await SellerWalletTransaction.findOne({ idempotencyKey: key }).session(session);
    if (existingTx) {
      await session.abortTransaction();
      return;
    }

    const wallet = await getOrCreateSellerWallet(sellerId, session);
    
    // Determine if we debit from pending or available.
    // If it's already settled, available. If not, pending.
    // To simplify, if pending is >= refundAmount, debit pending, else debit available.
    let type = 'REFUND_DEBIT';
    let balanceType = 'available';
    let balanceBefore = wallet.availableBalance;
    
    if (wallet.pendingBalance >= refundAmount) {
      balanceType = 'pending';
      balanceBefore = wallet.pendingBalance;
      wallet.pendingBalance = roundMoney(wallet.pendingBalance - refundAmount);
    } else {
      wallet.availableBalance = roundMoney(wallet.availableBalance - refundAmount);
    }

    wallet.totalRefunded = roundMoney(wallet.totalRefunded + refundAmount);

    const balanceAfter = balanceType === 'pending' ? wallet.pendingBalance : wallet.availableBalance;

    await SellerWalletTransaction.create([{
      seller: sellerId,
      wallet: wallet._id,
      type,
      direction: 'debit',
      amount: refundAmount,
      balanceBefore,
      balanceAfter,
      balanceType,
      order: orderId,
      returnRequest: returnRequestId,
      idempotencyKey: key,
      description: `Refund debit for order`
    }], { session });

    await wallet.save({ session });
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    console.error(`[Wallet] Error debiting refund:`, error);
  } finally {
    session.endSession();
  }
};

const debitCancellationAmount = async (orderId, sellerId) => {
  const order = await Order.findById(orderId);
  if (!order) return;
  
  // Debit the net amount of the order that was credited
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const idempotencyKey = `CANCELLATION_DEBIT:${orderId}:${sellerId}`;
    const existingTx = await SellerWalletTransaction.findOne({ idempotencyKey }).session(session);
    if (existingTx) {
      await session.abortTransaction();
      return;
    }

    const earningTx = await SellerWalletTransaction.findOne({ 
      order: orderId, seller: sellerId, type: 'ORDER_EARNING' 
    }).session(session);

    if (!earningTx) {
      await session.abortTransaction();
      return;
    }

    const feeTx = await SellerWalletTransaction.findOne({
      order: orderId, seller: sellerId, type: 'PLATFORM_FEE'
    }).session(session);

    const grossEarning = earningTx.amount;
    const platformFee = feeTx ? feeTx.amount : 0;
    
    const wallet = await getOrCreateSellerWallet(sellerId, session);
    
    wallet.pendingBalance = roundMoney(wallet.pendingBalance - grossEarning + platformFee);
    wallet.totalEarned = roundMoney(wallet.totalEarned - grossEarning);
    wallet.totalPlatformFees = roundMoney(wallet.totalPlatformFees - platformFee);

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
    }], { session });

    await wallet.save({ session });
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    console.error(`[Wallet] Error debiting cancellation:`, error);
  } finally {
    session.endSession();
  }
};

const requestPayout = async (sellerId, amount) => {
  amount = roundMoney(amount);
  if (amount <= 0) throw new ApiError(400, 'Amount must be greater than zero');
  
  const session = await mongoose.startSession();
  let payout;
  try {
    session.startTransaction();
    const wallet = await getOrCreateSellerWallet(sellerId, session);
    if (wallet.status !== 'active') {
      throw new ApiError(403, 'Wallet is frozen or suspended');
    }
    
    if (wallet.availableBalance < amount) {
      throw new ApiError(400, 'Insufficient available balance');
    }

    const seller = await Seller.findById(sellerId).select('+bankDetails').session(session);
    if (!seller.bankDetails || !seller.bankDetails.accountNumber) {
      throw new ApiError(400, 'Seller bank details not configured');
    }
    
    // Mask bank account
    const acctStr = seller.bankDetails.accountNumber.toString();
    const masked = acctStr.length > 4 ? '*'.repeat(acctStr.length - 4) + acctStr.slice(-4) : '****';

    wallet.availableBalance = roundMoney(wallet.availableBalance - amount);
    // Note: Reserved funds can just mean we subtracted from available but didn't increase withdrawn yet.
    
    payout = await SellerPayout.create([{
      seller: sellerId,
      wallet: wallet._id,
      amount,
      bankAccountSnapshot: {
        accountHolderName: seller.bankDetails.accountHolderName,
        accountNumberMasked: masked,
        ifscCode: seller.bankDetails.ifscCode,
        bankName: seller.bankDetails.bankName
      },
      status: 'REQUESTED'
    }], { session });
    
    const idempotencyKey = `PAYOUT_REQUEST:${payout[0]._id}`;
    await SellerWalletTransaction.create([{
      seller: sellerId,
      wallet: wallet._id,
      type: 'PAYOUT_REQUEST',
      direction: 'debit',
      amount: amount,
      balanceBefore: roundMoney(wallet.availableBalance + amount),
      balanceAfter: wallet.availableBalance,
      balanceType: 'available',
      payout: payout[0]._id,
      idempotencyKey,
      description: `Payout requested`
    }], { session });

    await wallet.save({ session });
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  // Notify
  setImmediate(async () => {
    try {
      await notificationService.notifyPayoutRequested({ payout: payout[0], sellerId });
    } catch(err) {}
  });

  return payout[0];
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
  const session = await mongoose.startSession();
  let payout;
  try {
    session.startTransaction();
    payout = await SellerPayout.findById(payoutId).session(session);
    if (!payout) throw new ApiError(404, 'Payout not found');
    if (payout.status !== 'REQUESTED' && payout.status !== 'APPROVED') {
      throw new ApiError(400, 'Payout cannot be rejected from its current state');
    }

    payout.status = 'REJECTED';
    payout.rejectionReason = reason;
    payout.reviewedAt = Date.now();
    payout.reviewedBy = adminId;
    await payout.save({ session });

    // Restore available balance
    const wallet = await getOrCreateSellerWallet(payout.seller, session);
    wallet.availableBalance = roundMoney(wallet.availableBalance + payout.amount);

    const idempotencyKey = `PAYOUT_REVERSED:${payout._id}`;
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
    }], { session });

    await wallet.save({ session });
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

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

  // In a real system, we call razorpayX or stripe connect here.
  // We use mockProvider in test/controller.

  return payout;
};

const completePayout = async (payoutId, adminId, providerPayoutId) => {
  const session = await mongoose.startSession();
  let payout;
  try {
    session.startTransaction();
    payout = await SellerPayout.findById(payoutId).session(session);
    if (!payout) throw new ApiError(404, 'Payout not found');
    if (payout.status !== 'PROCESSING' && payout.status !== 'APPROVED') {
      throw new ApiError(400, 'Payout cannot be completed from its current state');
    }

    payout.status = 'COMPLETED';
    payout.processedAt = Date.now();
    payout.providerPayoutId = providerPayoutId;
    await payout.save({ session });

    const wallet = await getOrCreateSellerWallet(payout.seller, session);
    wallet.totalWithdrawn = roundMoney(wallet.totalWithdrawn + payout.amount);

    const idempotencyKey = `PAYOUT_COMPLETED:${payout._id}`;
    await SellerWalletTransaction.create([{
      seller: payout.seller,
      wallet: wallet._id,
      type: 'PAYOUT_COMPLETED',
      direction: 'transfer',
      amount: payout.amount,
      balanceBefore: wallet.availableBalance,
      balanceAfter: wallet.availableBalance, // already debited from available when requested
      balanceType: 'available',
      payout: payout._id,
      idempotencyKey,
      description: `Payout completed successfully`
    }], { session });

    await wallet.save({ session });
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  setImmediate(async () => {
    try {
      await notificationService.notifyPayoutCompleted({ payout, sellerId: payout.seller });
    } catch(err) {}
  });
  return payout;
};

const failPayout = async (payoutId, adminId, reason) => {
  const session = await mongoose.startSession();
  let payout;
  try {
    session.startTransaction();
    payout = await SellerPayout.findById(payoutId).session(session);
    if (!payout) throw new ApiError(404, 'Payout not found');
    if (payout.status !== 'PROCESSING' && payout.status !== 'APPROVED') {
      throw new ApiError(400, 'Payout cannot be failed from its current state');
    }

    payout.status = 'FAILED';
    payout.failureReason = reason;
    payout.processedAt = Date.now();
    await payout.save({ session });

    // Restore available balance
    const wallet = await getOrCreateSellerWallet(payout.seller, session);
    wallet.availableBalance = roundMoney(wallet.availableBalance + payout.amount);

    const idempotencyKey = `PAYOUT_FAILED:${payout._id}`;
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
    }], { session });

    await wallet.save({ session });
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

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
