const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const Seller = require('../models/Seller');
const ReturnRequest = require('../models/ReturnRequest');
const SellerWallet = require('../models/SellerWallet');
const SellerPayout = require('../models/SellerPayout');
const SupportTicket = require('../models/SupportTicket');
const Category = require('../models/Category');

/**
 * Builds a date match query object based on the requested preset or custom range.
 */
const getDateMatchQuery = (period, startDate, endDate, dateField = 'createdAt') => {
  const match = {};
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  if (period) {
    switch (period) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        match[dateField] = { $gte: start };
        break;
      case 'yesterday':
        start.setDate(start.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        end.setDate(end.getDate() - 1);
        end.setHours(23, 59, 59, 999);
        match[dateField] = { $gte: start, $lte: end };
        break;
      case 'last7days':
        start.setDate(start.getDate() - 7);
        match[dateField] = { $gte: start };
        break;
      case 'last30days':
        start.setDate(start.getDate() - 30);
        match[dateField] = { $gte: start };
        break;
      case 'last90days':
        start.setDate(start.getDate() - 90);
        match[dateField] = { $gte: start };
        break;
      case 'thisMonth':
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        match[dateField] = { $gte: start };
        break;
      case 'lastMonth':
        start.setMonth(start.getMonth() - 1);
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setDate(0);
        end.setHours(23, 59, 59, 999);
        match[dateField] = { $gte: start, $lte: end };
        break;
      case 'thisYear':
        start.setMonth(0, 1);
        start.setHours(0, 0, 0, 0);
        match[dateField] = { $gte: start };
        break;
      case 'custom':
        if (startDate && endDate) {
          match[dateField] = { $gte: new Date(startDate), $lte: new Date(endDate) };
        } else if (startDate) {
          match[dateField] = { $gte: new Date(startDate) };
        } else if (endDate) {
          match[dateField] = { $lte: new Date(endDate) };
        }
        break;
    }
  }

  return match;
};

const getGroupByFormat = (groupBy) => {
  switch (groupBy) {
    case 'daily':
      return { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
    case 'weekly':
      return { $dateToString: { format: '%Y-%U', date: '$createdAt' } };
    case 'monthly':
      return { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
    default:
      return { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
  }
};

const safelyEscapeCSV = (value) => {
  if (value === null || value === undefined) return '';
  const strValue = String(value);
  if (/^[=+\-@]/.test(strValue)) {
    return `'${strValue}`;
  }
  return strValue;
};

class AnalyticsService {
  /**
   * ADMIN OVERVIEW
   */
  async getAdminOverview(query) {
    const { period, startDate, endDate } = query;
    const dateMatch = getDateMatchQuery(period, startDate, endDate);

    // Order metrics
    const orderPipeline = [
      { $match: dateMatch },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          paidOrders: { $sum: { $cond: [{ $in: ['$payment.status', ['paid', 'refunded']] }, 1, 0] } },
          processingOrders: { $sum: { $cond: [{ $eq: ['$orderStatus', 'processing'] }, 1, 0] } },
          shippedOrders: { $sum: { $cond: [{ $eq: ['$orderStatus', 'shipped'] }, 1, 0] } },
          deliveredOrders: { $sum: { $cond: [{ $eq: ['$orderStatus', 'delivered'] }, 1, 0] } },
          cancelledOrders: { $sum: { $cond: [{ $eq: ['$orderStatus', 'cancelled'] }, 1, 0] } },
          grossSales: { $sum: { $cond: [{ $eq: ['$payment.status', 'paid'] }, '$subtotal', 0] } },
          platformFees: { $sum: { $cond: [{ $eq: ['$payment.status', 'paid'] }, '$platformFee', 0] } },
          deliveryFees: { $sum: { $cond: [{ $eq: ['$payment.status', 'paid'] }, '$deliveryFee', 0] } }
        }
      }
    ];

    const returnsPipeline = [
      { $match: getDateMatchQuery(period, startDate, endDate, 'createdAt') },
      {
        $group: {
          _id: null,
          refundedOrders: { $sum: { $cond: [{ $eq: ['$status', 'refunded'] }, 1, 0] } },
          refundAmount: { $sum: { $cond: [{ $eq: ['$status', 'refunded'] }, '$refundAmount', 0] } }
        }
      }
    ];

    const usersPipeline = [
      { $match: { role: 'customer', ...dateMatch } },
      { $count: 'totalCustomers' }
    ];

    const sellersPipeline = [
      { $match: dateMatch },
      {
        $group: {
          _id: null,
          totalSellers: { $sum: 1 },
          activeSellers: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } }
        }
      }
    ];

    const productsPipeline = [
      { $match: dateMatch },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          publishedProducts: { $sum: { $cond: [{ $eq: ['$isPublished', true] }, 1, 0] } },
          outOfStockProducts: { $sum: { $cond: [{ $eq: ['$status', 'out_of_stock'] }, 1, 0] } }
        }
      }
    ];

    const payoutsPipeline = [
      { $match: dateMatch },
      {
        $group: {
          _id: null,
          payoutRequested: { $sum: { $cond: [{ $eq: ['$status', 'REQUESTED'] }, '$amount', 0] } },
          payoutCompleted: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, '$amount', 0] } },
          payoutFailed: { $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, '$amount', 0] } }
        }
      }
    ];

    const [ordersData, returnsData, usersData, sellersData, productsData, payoutsData] = await Promise.all([
      Order.aggregate(orderPipeline),
      ReturnRequest.aggregate(returnsPipeline),
      User.aggregate(usersPipeline),
      Seller.aggregate(sellersPipeline),
      Product.aggregate(productsPipeline),
      SellerPayout.aggregate(payoutsPipeline)
    ]);

    const o = ordersData[0] || {};
    const r = returnsData[0] || {};
    const u = usersData[0] || { totalCustomers: 0 };
    const s = sellersData[0] || {};
    const p = productsData[0] || {};
    const pay = payoutsData[0] || {};

    const grossSales = o.grossSales || 0;
    const refundAmount = r.refundAmount || 0;
    const netSales = Math.max(0, grossSales - refundAmount);

    return {
      totalOrders: o.totalOrders || 0,
      paidOrders: o.paidOrders || 0,
      processingOrders: o.processingOrders || 0,
      shippedOrders: o.shippedOrders || 0,
      deliveredOrders: o.deliveredOrders || 0,
      cancelledOrders: o.cancelledOrders || 0,
      refundedOrders: r.refundedOrders || 0,
      totalCustomers: u.totalCustomers || 0,
      totalSellers: s.totalSellers || 0,
      activeSellers: s.activeSellers || 0,
      totalProducts: p.totalProducts || 0,
      publishedProducts: p.publishedProducts || 0,
      outOfStockProducts: p.outOfStockProducts || 0,
      grossSales,
      netSales,
      platformFees: o.platformFees || 0,
      deliveryFees: o.deliveryFees || 0,
      refundAmount,
      sellerEarnings: Math.max(0, netSales - (o.platformFees || 0)),
      payoutRequested: pay.payoutRequested || 0,
      payoutCompleted: pay.payoutCompleted || 0,
      payoutFailed: pay.payoutFailed || 0
    };
  }

  /**
   * ADMIN SALES TREND
   */
  async getAdminSalesTrend(query) {
    const { period, startDate, endDate, groupBy = 'daily' } = query;
    const dateMatch = getDateMatchQuery(period, startDate, endDate);

    const matchGroup = getGroupByFormat(groupBy);

    const pipeline = [
      { $match: { ...dateMatch, 'payment.status': 'paid' } },
      {
        $group: {
          _id: matchGroup,
          orders: { $sum: 1 },
          grossSales: { $sum: '$subtotal' },
          platformFees: { $sum: '$platformFee' }
        }
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: '$_id',
          orders: 1,
          grossSales: 1,
          platformFees: 1
        }
      }
    ];

    const trend = await Order.aggregate(pipeline);

    // Aggregate refunds independently and merge
    const refundsPipeline = [
      { $match: { ...getDateMatchQuery(period, startDate, endDate, 'createdAt'), status: 'refunded' } },
      {
        $group: {
          _id: getGroupByFormat(groupBy),
          refunds: { $sum: '$refundAmount' }
        }
      }
    ];
    const refundsTrend = await ReturnRequest.aggregate(refundsPipeline);
    const refundMap = {};
    for (const r of refundsTrend) {
      refundMap[r._id] = r.refunds;
    }

    return trend.map(t => {
      const refunds = refundMap[t.date] || 0;
      return {
        ...t,
        netSales: Math.max(0, t.grossSales - refunds),
        refunds
      };
    });
  }

  /**
   * SELLER OVERVIEW
   */
  async getSellerOverview(sellerId, query) {
    const { period, startDate, endDate } = query;
    const dateMatch = getDateMatchQuery(period, startDate, endDate);

    // Unwind order items to calculate seller-specific metrics
    const orderPipeline = [
      { $match: dateMatch },
      { $unwind: '$items' },
      { $match: { 'items.seller': new mongoose.Types.ObjectId(sellerId) } },
      {
        $group: {
          _id: '$orderNumber',
          paid: { $first: { $cond: [{ $in: ['$payment.status', ['paid', 'refunded']] }, 1, 0] } },
          cancelled: { $first: { $cond: [{ $eq: ['$orderStatus', 'cancelled'] }, 1, 0] } },
          unitsSold: { $sum: '$items.quantity' },
          grossSales: { $sum: '$items.itemSubtotal' }
        }
      },
      {
        $group: {
          _id: null,
          orders: { $sum: 1 },
          paidOrders: { $sum: '$paid' },
          cancelledOrders: { $sum: '$cancelled' },
          unitsSold: { $sum: { $cond: [{ $eq: ['$paid', 1] }, '$unitsSold', 0] } },
          grossSales: { $sum: { $cond: [{ $eq: ['$paid', 1] }, '$grossSales', 0] } }
        }
      }
    ];

    const walletPipeline = [
      { $match: { seller: new mongoose.Types.ObjectId(sellerId) } },
      {
        $project: {
          totalEarned: 1,
          totalRefunded: 1,
          totalPlatformFees: 1
        }
      }
    ];

    const payoutsPipeline = [
      { $match: { seller: new mongoose.Types.ObjectId(sellerId), ...dateMatch } },
      {
        $group: {
          _id: null,
          payoutRequested: { $sum: { $cond: [{ $eq: ['$status', 'REQUESTED'] }, '$amount', 0] } },
          payoutCompleted: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, '$amount', 0] } },
          payoutFailed: { $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, '$amount', 0] } }
        }
      }
    ];

    const returnsPipeline = [
      { $match: { seller: new mongoose.Types.ObjectId(sellerId), ...getDateMatchQuery(period, startDate, endDate, 'createdAt') } },
      {
        $group: {
          _id: null,
          refunds: { $sum: { $cond: [{ $eq: ['$status', 'refunded'] }, '$refundAmount', 0] } },
          cancellations: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } }
        }
      }
    ];

    const [ordersData, walletData, payoutsData, returnsData] = await Promise.all([
      Order.aggregate(orderPipeline),
      SellerWallet.findOne({ seller: sellerId }),
      SellerPayout.aggregate(payoutsPipeline),
      ReturnRequest.aggregate(returnsPipeline)
    ]);

    const o = ordersData[0] || {};
    const w = walletData || {};
    const p = payoutsData[0] || {};
    const r = returnsData[0] || {};

    const grossSales = o.grossSales || 0;
    const ordersCount = o.paidOrders || 0;
    const averageOrderValue = ordersCount > 0 ? grossSales / ordersCount : 0;

    return {
      orders: o.orders || 0,
      unitsSold: o.unitsSold || 0,
      grossSales,
      platformFees: w.totalPlatformFees || 0,
      sellerEarnings: w.totalEarned || 0,
      refunds: r.refunds || 0,
      cancellations: r.cancellations || 0,
      payoutRequested: p.payoutRequested || 0,
      payoutCompleted: p.payoutCompleted || 0,
      payoutFailed: p.payoutFailed || 0,
      averageOrderValue,
      topProducts: []
    };
  }

  // Export to CSV
  async generateCSV(data) {
    if (!data || data.length === 0) return '';
    const safeData = data.map(row => {
      const safeRow = {};
      for (const [key, value] of Object.entries(row)) {
        safeRow[key] = safelyEscapeCSV(value);
      }
      return safeRow;
    });
    const headers = Object.keys(safeData[0]).join(',');
    const rows = safeData.map(row => Object.values(row).map(v => `"${v}"`).join(',')).join('\n');
    return `${headers}\n${rows}`;
  }

}

module.exports = new AnalyticsService();
