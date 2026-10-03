const Seller = require('../models/Seller');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const ApiError = require('../utils/ApiError');
const { logAdminAction } = require('./adminAuditService');

/**
 * Returns paginated seller list with business name/email search & filters.
 */
const getSellers = async ({ page = 1, limit = 20, search, businessType, verificationStatus }) => {
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const query = {};

  if (businessType) {
    query.businessType = businessType;
  }

  if (verificationStatus) {
    query.verificationStatus = verificationStatus;
  }

  if (search && typeof search === 'string' && search.trim().length > 0) {
    const searchRegex = new RegExp(search.trim(), 'i');
    
    // Find matching users first if searching by email/name
    const matchingUsers = await User.find({
      $or: [{ name: searchRegex }, { email: searchRegex }]
    }).select('_id');
    const userIds = matchingUsers.map((u) => u._id);

    query.$or = [
      { businessName: searchRegex },
      { user: { $in: userIds } }
    ];
  }

  const [sellers, total] = await Promise.all([
    Seller.find(query)
      .populate('user', 'name email role isBlocked isEmailVerified')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Seller.countDocuments(query)
  ]);

  return {
    sellers,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum)
  };
};

/**
 * Returns single seller profile detail with product count & order count metrics.
 */
const getSellerById = async (sellerId) => {
  const seller = await Seller.findById(sellerId)
    .populate('user', 'name email role isBlocked isEmailVerified createdAt')
    .lean();

  if (!seller) {
    throw new ApiError(404, 'Seller profile not found');
  }

  const [productCount, orderCount] = await Promise.all([
    Product.countDocuments({ seller: sellerId }),
    Order.countDocuments({ 'items.seller': sellerId })
  ]);

  return {
    seller,
    metrics: {
      productCount,
      orderCount
    }
  };
};

/**
 * Blocks a seller profile and associated user account.
 * Preserves all historical product, order, and transaction records.
 */
const blockSeller = async (adminId, sellerId, req) => {
  const seller = await Seller.findById(sellerId);
  if (!seller) {
    throw new ApiError(404, 'Seller profile not found');
  }

  seller.verificationStatus = 'blocked';
  await seller.save();

  // Also block associated user account so dashboard login/APIs are rejected
  if (seller.user) {
    await User.findByIdAndUpdate(seller.user, { isBlocked: true });
  }

  await logAdminAction({
    adminId,
    action: 'SELLER_BLOCKED',
    targetType: 'Seller',
    targetId: sellerId,
    metadata: { businessName: seller.businessName, userId: seller.user },
    req
  });

  return {
    message: 'Seller account blocked successfully. Historical data preserved.',
    seller
  };
};

/**
 * Unblocks a seller profile and associated user account.
 */
const unblockSeller = async (adminId, sellerId, req) => {
  const seller = await Seller.findById(sellerId);
  if (!seller) {
    throw new ApiError(404, 'Seller profile not found');
  }

  seller.verificationStatus = 'approved';
  await seller.save();

  if (seller.user) {
    await User.findByIdAndUpdate(seller.user, { isBlocked: false });
  }

  await logAdminAction({
    adminId,
    action: 'SELLER_UNBLOCKED',
    targetType: 'Seller',
    targetId: sellerId,
    metadata: { businessName: seller.businessName, userId: seller.user },
    req
  });

  return {
    message: 'Seller account unblocked successfully.',
    seller
  };
};

/**
 * Suspends a seller profile (operational suspension, not full block).
 * Seller loses dashboard access (verificationStatus !== 'approved').
 * Historical data, products, and orders are preserved.
 */
const suspendSeller = async (adminId, sellerId, reason, req) => {
  const seller = await Seller.findById(sellerId);
  if (!seller) {
    throw new ApiError(404, 'Seller profile not found');
  }

  if (seller.verificationStatus === 'suspended') {
    return {
      message: 'Seller is already suspended',
      seller
    };
  }

  seller.verificationStatus = 'suspended';
  await seller.save();

  await logAdminAction({
    adminId,
    action: 'SELLER_SUSPENDED',
    targetType: 'Seller',
    targetId: sellerId,
    metadata: { businessName: seller.businessName, userId: seller.user, reason: reason || null },
    req
  });

  return {
    message: 'Seller account suspended. Historical data preserved.',
    seller
  };
};

/**
 * Reactivates a suspended or blocked seller profile.
 * Restores verificationStatus to 'approved' and unblocks associated user.
 */
const reactivateSeller = async (adminId, sellerId, req) => {
  const seller = await Seller.findById(sellerId);
  if (!seller) {
    throw new ApiError(404, 'Seller profile not found');
  }

  if (seller.verificationStatus === 'approved') {
    return {
      message: 'Seller is already active',
      seller
    };
  }

  seller.verificationStatus = 'approved';
  await seller.save();

  // Also unblock associated user account if it was blocked
  if (seller.user) {
    await User.findByIdAndUpdate(seller.user, { isBlocked: false });
  }

  await logAdminAction({
    adminId,
    action: 'SELLER_REACTIVATED',
    targetType: 'Seller',
    targetId: sellerId,
    metadata: { businessName: seller.businessName, userId: seller.user },
    req
  });

  return {
    message: 'Seller account reactivated successfully.',
    seller
  };
};

module.exports = {
  getSellers,
  getSellerById,
  blockSeller,
  unblockSeller,
  suspendSeller,
  reactivateSeller
};
