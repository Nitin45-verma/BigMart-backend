const Order = require('../models/Order');
const { roundMoney } = require('../utils/moneyUtils');
const { getSellerPlatformFeeRate, calculateItemPlatformFee } = require('../config/platformFeeConfig');

/**
 * Returns marketplace sales analytics aggregated by day over a specified date range.
 */
const getSalesAnalytics = async ({ period = '30d', from, to }) => {
  let startDate;
  let endDate = new Date();

  if (from && to) {
    startDate = new Date(from);
    endDate = new Date(to);
  } else {
    const daysMap = { '7d': 7, '30d': 30, '90d': 90 };
    const days = daysMap[period] || 30;
    startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
  }

  const paidOrders = await Order.find({
    $or: [{ 'payment.status': 'paid' }, { orderStatus: 'paid' }],
    createdAt: { $gte: startDate, $lte: endDate }
  })
    .populate('items.seller')
    .sort({ createdAt: 1 });

  let totalGrossSales = 0;
  let totalPlatformFees = 0;
  let totalShippingRevenue = 0;
  let totalUnitsSold = 0;

  const dailyMap = new Map();

  for (const order of paidOrders) {
    const dateStr = new Date(order.createdAt).toISOString().slice(0, 10);

    if (!dailyMap.has(dateStr)) {
      dailyMap.set(dateStr, {
        date: dateStr,
        grossSales: 0,
        platformFees: 0,
        shippingRevenue: 0,
        unitsSold: 0,
        orderCount: 0
      });
    }

    const dayEntry = dailyMap.get(dateStr);
    dayEntry.orderCount += 1;

    const orderShipping = order.deliveryFee || 0;
    dayEntry.shippingRevenue = roundMoney(dayEntry.shippingRevenue + orderShipping);
    totalShippingRevenue = roundMoney(totalShippingRevenue + orderShipping);

    for (const item of order.items) {
      const itemTotal = item.itemTotal;
      const feeRate = getSellerPlatformFeeRate(item.seller);
      const itemFee = calculateItemPlatformFee(itemTotal, feeRate);

      dayEntry.grossSales = roundMoney(dayEntry.grossSales + itemTotal);
      dayEntry.platformFees = roundMoney(dayEntry.platformFees + itemFee);
      dayEntry.unitsSold += item.quantity;

      totalGrossSales = roundMoney(totalGrossSales + itemTotal);
      totalPlatformFees = roundMoney(totalPlatformFees + itemFee);
      totalUnitsSold += item.quantity;
    }
  }

  const dailySales = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  return {
    period: from && to ? 'custom' : period,
    startDate,
    endDate,
    totals: {
      orderCount: paidOrders.length,
      grossSales: roundMoney(totalGrossSales),
      platformFees: roundMoney(totalPlatformFees),
      shippingRevenue: roundMoney(totalShippingRevenue),
      unitsSold: totalUnitsSold
    },
    dailySales
  };
};

module.exports = {
  getSalesAnalytics
};
