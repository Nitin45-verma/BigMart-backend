const Order = require('../models/Order');
const ReturnRequest = require('../models/ReturnRequest');
const { roundMoney } = require('../utils/moneyUtils');
const { getSellerPlatformFeeRate, calculateItemPlatformFee } = require('../config/platformFeeConfig');

/**
 * Builds date range from period shorthand or explicit from/to dates.
 */
const buildDateRange = (period, from, to) => {
  const endDate = to ? new Date(to) : new Date();
  if (from) {
    return { startDate: new Date(from), endDate };
  }

  const daysMap = { '7d': 7, '30d': 30, '90d': 90, all: null };
  const days = daysMap[period] !== undefined ? daysMap[period] : 30;

  if (days === null) {
    return { startDate: null, endDate };
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  return { startDate, endDate };
};

/**
 * Returns platform-level financial summary derived entirely from immutable DB order snapshots.
 * Derived fields only — never trusts client-provided financial values.
 *
 * Metrics:
 * - grossSales: Sum of grandTotal for paid orders
 * - platformFees: Estimated from item totals × server-calculated fee rate
 * - shippingCollected: Sum of deliveryFee on paid orders
 * - netSales: grossSales - shippingCollected (merchandise revenue)
 * - refunds: Total refundAmount from completed refunds
 * - refundCount: Number of refunded orders
 * - paidOrderCount: Number of paid orders in range
 * - orderCount: Total orders in range
 */
const getFinanceSummary = async ({ period = '30d', from, to } = {}) => {
  const { startDate, endDate } = buildDateRange(period, from, to);

  const dateFilter = startDate
    ? { createdAt: { $gte: startDate, $lte: endDate } }
    : { createdAt: { $lte: endDate } };

  const paidFilter = {
    $or: [{ 'payment.status': 'paid' }, { orderStatus: 'paid' }],
    ...dateFilter
  };

  // Paid orders for revenue calculations
  const [paidOrders, totalOrderCount, refundedReturns] = await Promise.all([
    Order.find(paidFilter)
      .populate('items.seller', 'businessType platformFeeRate sellerPlan')
      .lean(),
    Order.countDocuments(dateFilter),
    ReturnRequest.find({
      refundStatus: 'completed',
      updatedAt: dateFilter.createdAt ? { $gte: dateFilter.createdAt.$gte, $lte: dateFilter.createdAt.$lte } : undefined
    }).lean()
  ]);

  let grossSales = 0;
  let platformFees = 0;
  let shippingCollected = 0;

  for (const order of paidOrders) {
    grossSales = roundMoney(grossSales + (order.grandTotal || 0));
    shippingCollected = roundMoney(shippingCollected + (order.deliveryFee || 0));

    for (const item of order.items) {
      const feeRate = getSellerPlatformFeeRate(item.seller);
      platformFees = roundMoney(platformFees + calculateItemPlatformFee(item.itemTotal, feeRate));
    }
  }

  const refunds = roundMoney(
    refundedReturns.reduce((sum, r) => sum + (r.refundAmount || 0) + (r.shippingRefund || 0), 0)
  );

  const netSales = roundMoney(grossSales - shippingCollected);

  return {
    period: from && to ? 'custom' : period,
    from: startDate ? startDate.toISOString() : null,
    to: endDate.toISOString(),
    metrics: {
      paidOrderCount: paidOrders.length,
      totalOrderCount,
      grossSales,
      shippingCollected,
      netSales,
      platformFees,
      refunds,
      refundCount: refundedReturns.length
    }
  };
};

module.exports = {
  getFinanceSummary
};
