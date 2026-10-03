const Product = require('../models/Product');
const Order = require('../models/Order');
const Seller = require('../models/Seller');
const ApiError = require('../utils/ApiError');
const { roundMoney } = require('../utils/moneyUtils');
const { getSellerPlatformFeeRate, calculateItemPlatformFee } = require('../config/platformFeeConfig');

/**
 * Returns sanitized seller business profile.
 */
const getSellerProfile = (seller) => {
  return {
    sellerId: seller._id,
    businessName: seller.businessName,
    businessType: seller.businessType,
    description: seller.description || '',
    businessAddress: seller.businessAddress || {},
    pickupAddress: seller.pickupAddress || {},
    city: seller.businessAddress?.city || '',
    state: seller.businessAddress?.state || '',
    country: seller.businessAddress?.country || 'India',
    postalCode: seller.businessAddress?.postalCode || '',
    latitude: seller.latitude ?? seller.businessAddress?.latitude ?? null,
    longitude: seller.longitude ?? seller.businessAddress?.longitude ?? null,
    verificationStatus: seller.verificationStatus,
    platformFeeRate: getSellerPlatformFeeRate(seller),
    rating: seller.rating || 0,
    reviewCount: seller.reviewCount || 0,
    createdAt: seller.createdAt,
    updatedAt: seller.updatedAt
  };
};

/**
 * Updates seller business fields (protected fields excluded by validator & explicit assignment).
 */
const updateSellerProfile = async (seller, updateData) => {
  const allowedUpdates = {};

  if (updateData.businessName !== undefined) {
    allowedUpdates.businessName = updateData.businessName.trim();
  }

  if (updateData.description !== undefined) {
    allowedUpdates.description = updateData.description ? updateData.description.trim() : '';
  }

  if (updateData.latitude !== undefined) {
    allowedUpdates.latitude = updateData.latitude !== null ? Number(updateData.latitude) : null;
  }

  if (updateData.longitude !== undefined) {
    allowedUpdates.longitude = updateData.longitude !== null ? Number(updateData.longitude) : null;
  }

  // Handle businessAddress updates
  if (updateData.businessAddress && typeof updateData.businessAddress === 'object') {
    allowedUpdates.businessAddress = {
      ...seller.businessAddress?.toObject?.(),
      ...updateData.businessAddress
    };
  }

  // Handle top-level address fields fallback into businessAddress
  if (updateData.city || updateData.state || updateData.country || updateData.postalCode) {
    allowedUpdates.businessAddress = {
      ...seller.businessAddress?.toObject?.(),
      ...allowedUpdates.businessAddress,
      ...(updateData.city && { city: updateData.city.trim() }),
      ...(updateData.state && { state: updateData.state.trim() }),
      ...(updateData.country && { country: updateData.country.trim() }),
      ...(updateData.postalCode && { postalCode: updateData.postalCode.trim() })
    };
  }

  // Handle pickupAddress updates
  if (updateData.pickupAddress && typeof updateData.pickupAddress === 'object') {
    allowedUpdates.pickupAddress = {
      ...seller.pickupAddress?.toObject?.(),
      ...updateData.pickupAddress
    };
  }

  const updatedSeller = await Seller.findByIdAndUpdate(
    seller._id,
    { $set: allowedUpdates },
    { new: true, runValidators: true }
  );

  return getSellerProfile(updatedSeller);
};

/**
 * Aggregates product and sales metrics for the seller dashboard.
 */
const getDashboardSummary = async (seller) => {
  const sellerId = seller._id;

  // 1. Calculate product status breakdown for seller
  const [total, active, draft, inactive, outOfStock, archived] = await Promise.all([
    Product.countDocuments({ seller: sellerId }),
    Product.countDocuments({ seller: sellerId, status: 'active', isPublished: true }),
    Product.countDocuments({ seller: sellerId, status: 'draft' }),
    Product.countDocuments({ seller: sellerId, status: 'inactive' }),
    Product.countDocuments({ seller: sellerId, $or: [{ status: 'out_of_stock' }, { stock: 0 }] }),
    Product.countDocuments({ seller: sellerId, status: 'archived' })
  ]);

  // 2. Fetch financially valid (paid) orders containing items from this seller
  const paidOrders = await Order.find({
    'items.seller': sellerId,
    $or: [{ 'payment.status': 'paid' }, { orderStatus: 'paid' }]
  });

  const feeRate = getSellerPlatformFeeRate(seller);

  let unitsSold = 0;
  let grossSales = 0;
  let platformFees = 0;
  let costOfGoodsSum = 0;
  let hasMissingCostSnapshot = false;

  const sellerOrderIds = new Set();

  for (const order of paidOrders) {
    let orderHasSellerItem = false;

    for (const item of order.items) {
      if (item.seller && item.seller.toString() === sellerId.toString()) {
        orderHasSellerItem = true;
        unitsSold += item.quantity;

        const itemTotal = item.itemTotal;
        grossSales = roundMoney(grossSales + itemTotal);

        const itemFee = calculateItemPlatformFee(itemTotal, feeRate);
        platformFees = roundMoney(platformFees + itemFee);

        if (item.costPrice !== undefined && item.costPrice !== null && typeof item.costPrice === 'number') {
          costOfGoodsSum = roundMoney(costOfGoodsSum + roundMoney(item.quantity * item.costPrice));
        } else {
          hasMissingCostSnapshot = true;
        }
      }
    }

    if (orderHasSellerItem) {
      sellerOrderIds.add(order._id.toString());
    }
  }

  const ReturnRequest = require('../models/ReturnRequest');
  const refundedReturns = await ReturnRequest.find({
    seller: sellerId,
    $or: [{ status: 'refunded' }, { refundStatus: 'processed' }]
  });

  let totalRefundedAmount = 0;
  let totalRefundedUnits = 0;

  for (const ret of refundedReturns) {
    totalRefundedAmount = roundMoney(totalRefundedAmount + (ret.refundAmount || 0));
    for (const item of ret.items) {
      totalRefundedUnits += item.quantity;
    }
  }

  const netUnitsSold = Math.max(0, unitsSold - totalRefundedUnits);
  const netGrossSales = Math.max(0, roundMoney(grossSales - totalRefundedAmount));
  const adjustedPlatformFees = calculateItemPlatformFee(netGrossSales, feeRate);
  const netRevenue = roundMoney(netGrossSales - adjustedPlatformFees);
  const costOfGoods = hasMissingCostSnapshot || (paidOrders.length === 0 && unitsSold === 0) ? (hasMissingCostSnapshot ? null : 0) : costOfGoodsSum;
  const estimatedProfit = costOfGoods !== null ? roundMoney(netRevenue - costOfGoods) : null;

  return {
    products: {
      total,
      active,
      draft,
      inactive,
      outOfStock,
      archived
    },
    sales: {
      orders: sellerOrderIds.size,
      unitsSold: netUnitsSold,
      grossSales: roundMoney(netGrossSales),
      refundAmount: roundMoney(totalRefundedAmount),
      platformFees: roundMoney(adjustedPlatformFees),
      netRevenue: roundMoney(netRevenue),
      costOfGoods,
      estimatedProfit
    }
  };
};

/**
 * Returns seller-specific order history with strict multi-vendor isolation.
 */
const getSellerOrders = async (seller, { page = 1, limit = 20, status, from, to }) => {
  const sellerId = seller._id;
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const query = {
    'items.seller': sellerId
  };

  if (status) {
    query.orderStatus = status;
  }

  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = new Date(from);
    if (to) query.createdAt.$lte = new Date(to);
  }

  const [rawOrders, total] = await Promise.all([
    Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Order.countDocuments(query)
  ]);

  const feeRate = getSellerPlatformFeeRate(seller);

  const orders = rawOrders.map((order) => {
    const sellerItems = order.items.filter(
      (item) => item.seller && item.seller.toString() === sellerId.toString()
    );

    let sellerSubtotal = 0;
    let platformFee = 0;

    const formattedItems = sellerItems.map((item) => {
      const itemTotal = item.itemTotal;
      sellerSubtotal = roundMoney(sellerSubtotal + itemTotal);
      const itemFee = calculateItemPlatformFee(itemTotal, feeRate);
      platformFee = roundMoney(platformFee + itemFee);

      return {
        product: item.product,
        name: item.name,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        gstRate: item.gstRate,
        gstAmount: item.gstAmount,
        itemSubtotal: item.itemSubtotal,
        itemTotal: item.itemTotal
      };
    });

    const sellerNetRevenue = roundMoney(sellerSubtotal - platformFee);

    return {
      orderId: order._id,
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      paymentStatus: order.payment?.status || 'created',
      createdAt: order.createdAt,
      items: formattedItems,
      shippingAddress: {
        fullName: order.shippingAddress?.fullName,
        phone: order.shippingAddress?.phone,
        addressLine1: order.shippingAddress?.addressLine1,
        addressLine2: order.shippingAddress?.addressLine2,
        city: order.shippingAddress?.city,
        state: order.shippingAddress?.state,
        country: order.shippingAddress?.country || 'India',
        postalCode: order.shippingAddress?.postalCode
      },
      sellerSubtotal,
      platformFee,
      sellerNetRevenue
    };
  });

  return {
    orders,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum)
  };
};

/**
 * Returns detailed view of a specific order containing seller items.
 */
const getSellerOrderById = async (seller, orderId) => {
  const sellerId = seller._id;

  const order = await Order.findOne({
    _id: orderId,
    'items.seller': sellerId
  }).lean();

  if (!order) {
    throw new ApiError(404, 'Order not found or does not contain items for your account');
  }

  const feeRate = getSellerPlatformFeeRate(seller);
  const sellerItems = order.items.filter(
    (item) => item.seller && item.seller.toString() === sellerId.toString()
  );

  let sellerSubtotal = 0;
  let platformFee = 0;

  const formattedItems = sellerItems.map((item) => {
    const itemTotal = item.itemTotal;
    sellerSubtotal = roundMoney(sellerSubtotal + itemTotal);
    const itemFee = calculateItemPlatformFee(itemTotal, feeRate);
    platformFee = roundMoney(platformFee + itemFee);

    return {
      product: item.product,
      name: item.name,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      gstRate: item.gstRate,
      gstAmount: item.gstAmount,
      itemSubtotal: item.itemSubtotal,
      itemTotal: item.itemTotal
    };
  });

  const sellerNetRevenue = roundMoney(sellerSubtotal - platformFee);

  return {
    orderId: order._id,
    orderNumber: order.orderNumber,
    orderStatus: order.orderStatus,
    paymentStatus: order.payment?.status || 'created',
    createdAt: order.createdAt,
    items: formattedItems,
    shippingAddress: {
      fullName: order.shippingAddress?.fullName,
      phone: order.shippingAddress?.phone,
      addressLine1: order.shippingAddress?.addressLine1,
      addressLine2: order.shippingAddress?.addressLine2,
      city: order.shippingAddress?.city,
      state: order.shippingAddress?.state,
      country: order.shippingAddress?.country || 'India',
      postalCode: order.shippingAddress?.postalCode
    },
    sellerSubtotal,
    platformFee,
    sellerNetRevenue
  };
};

/**
 * Returns seller's product catalog list with filtering & pagination.
 */
const getSellerProducts = async (seller, { page = 1, limit = 20, status, search, category, stock }) => {
  const sellerId = seller._id;
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const query = { seller: sellerId };

  if (status) {
    query.status = status;
  }

  if (category) {
    query.category = category;
  }

  if (stock === 'out_of_stock' || stock === '0') {
    query.stock = 0;
  } else if (stock === 'low_stock') {
    query.$expr = { $lte: ['$stock', '$lowStockThreshold'] };
  }

  if (search && typeof search === 'string' && search.trim().length > 0) {
    const searchRegex = new RegExp(search.trim(), 'i');
    query.$or = [
      { name: searchRegex },
      { sku: searchRegex },
      { brand: searchRegex }
    ];
  }

  const [products, total] = await Promise.all([
    Product.find(query)
      .populate('category', 'name slug')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Product.countDocuments(query)
  ]);

  return {
    products,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum)
  };
};

/**
 * Returns daily aggregated sales summary for period filtering.
 */
const getSellerSalesSummary = async (seller, { period = '30d', from, to }) => {
  const sellerId = seller._id;
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
    'items.seller': sellerId,
    $or: [{ 'payment.status': 'paid' }, { orderStatus: 'paid' }],
    createdAt: { $gte: startDate, $lte: endDate }
  }).sort({ createdAt: 1 });

  const feeRate = getSellerPlatformFeeRate(seller);
  const dailyMap = new Map();

  for (const order of paidOrders) {
    const dateStr = new Date(order.createdAt).toISOString().slice(0, 10);

    if (!dailyMap.has(dateStr)) {
      dailyMap.set(dateStr, {
        date: dateStr,
        grossSales: 0,
        platformFees: 0,
        netRevenue: 0,
        unitsSold: 0
      });
    }

    const dayEntry = dailyMap.get(dateStr);

    for (const item of order.items) {
      if (item.seller && item.seller.toString() === sellerId.toString()) {
        const itemTotal = item.itemTotal;
        const itemFee = calculateItemPlatformFee(itemTotal, feeRate);

        dayEntry.grossSales = roundMoney(dayEntry.grossSales + itemTotal);
        dayEntry.platformFees = roundMoney(dayEntry.platformFees + itemFee);
        dayEntry.unitsSold += item.quantity;
      }
    }

    dayEntry.netRevenue = roundMoney(dayEntry.grossSales - dayEntry.platformFees);
  }

  const sales = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  return {
    period: from && to ? 'custom' : period,
    startDate,
    endDate,
    sales
  };
};

module.exports = {
  getSellerProfile,
  updateSellerProfile,
  getDashboardSummary,
  getSellerOrders,
  getSellerOrderById,
  getSellerProducts,
  getSellerSalesSummary
};
