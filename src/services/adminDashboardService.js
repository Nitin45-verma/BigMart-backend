const User = require('../models/User');
const Seller = require('../models/Seller');
const SellerApplication = require('../models/SellerApplication');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Order = require('../models/Order');
const { roundMoney } = require('../utils/moneyUtils');
const { getSellerPlatformFeeRate, calculateItemPlatformFee } = require('../config/platformFeeConfig');

/**
 * Returns marketplace-level metrics for the Admin Dashboard.
 */
const getAdminDashboardSummary = async () => {
  const [
    totalUsers,
    totalCustomers,
    totalSellers,
    blockedUsers,
    pendingSellerApps,
    approvedSellers,
    blockedSellers,
    totalProducts,
    activeProducts,
    inactiveProducts,
    archivedProducts,
    totalCategories,
    totalOrders,
    paidOrdersCount,
    pendingOrdersCount,
    cancelledOrdersCount,
    paidOrders
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ role: 'customer' }),
    User.countDocuments({ role: 'seller' }),
    User.countDocuments({ isBlocked: true }),
    SellerApplication ? SellerApplication.countDocuments({ status: 'pending' }) : Seller.countDocuments({ verificationStatus: 'pending' }),
    Seller.countDocuments({ verificationStatus: 'approved' }),
    Seller.countDocuments({ verificationStatus: { $in: ['blocked', 'suspended'] } }),
    Product.countDocuments({}),
    Product.countDocuments({ status: 'active', isPublished: true }),
    Product.countDocuments({ status: 'inactive' }),
    Product.countDocuments({ status: 'archived' }),
    Category.countDocuments({}),
    Order.countDocuments({}),
    Order.countDocuments({ $or: [{ 'payment.status': 'paid' }, { orderStatus: 'paid' }] }),
    Order.countDocuments({ orderStatus: 'pending_payment' }),
    Order.countDocuments({ orderStatus: 'cancelled' }),
    Order.find({ $or: [{ 'payment.status': 'paid' }, { orderStatus: 'paid' }] }).populate('items.seller')
  ]);

  let totalGrossMerchandiseValue = 0;
  let totalPlatformFees = 0;
  let totalShippingFees = 0;

  for (const order of paidOrders) {
    totalGrossMerchandiseValue = roundMoney(totalGrossMerchandiseValue + (order.grandTotal || 0));
    totalShippingFees = roundMoney(totalShippingFees + (order.deliveryFee || 0));

    for (const item of order.items) {
      const feeRate = getSellerPlatformFeeRate(item.seller);
      const itemFee = calculateItemPlatformFee(item.itemTotal, feeRate);
      totalPlatformFees = roundMoney(totalPlatformFees + itemFee);
    }
  }

  return {
    users: {
      total: totalUsers,
      customers: totalCustomers,
      sellers: totalSellers,
      blocked: blockedUsers
    },
    sellers: {
      pendingApplications: pendingSellerApps,
      approved: approvedSellers,
      blocked: blockedSellers
    },
    products: {
      total: totalProducts,
      active: activeProducts,
      inactive: inactiveProducts,
      archived: archivedProducts
    },
    categories: {
      total: totalCategories
    },
    orders: {
      total: totalOrders,
      paid: paidOrdersCount,
      pending: pendingOrdersCount,
      cancelled: cancelledOrdersCount
    },
    financials: {
      grossMerchandiseValue: roundMoney(totalGrossMerchandiseValue),
      platformFees: roundMoney(totalPlatformFees),
      shippingFees: roundMoney(totalShippingFees)
    }
  };
};

module.exports = {
  getAdminDashboardSummary
};
