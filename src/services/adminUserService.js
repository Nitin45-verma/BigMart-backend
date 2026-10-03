const User = require('../models/User');
const Seller = require('../models/Seller');
const Address = require('../models/Address');
const ApiError = require('../utils/ApiError');
const { logAdminAction } = require('./adminAuditService');

/**
 * Returns paginated user list with filtering and search.
 */
const getUsers = async ({ page = 1, limit = 20, search, role, isBlocked }) => {
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const query = {};

  if (role) {
    query.role = role;
  }

  if (isBlocked !== undefined && isBlocked !== '') {
    query.isBlocked = String(isBlocked) === 'true';
  }

  if (search && typeof search === 'string' && search.trim().length > 0) {
    const searchRegex = new RegExp(search.trim(), 'i');
    query.$or = [
      { name: searchRegex },
      { email: searchRegex }
    ];
  }

  const [users, total] = await Promise.all([
    User.find(query)
      .select('-password -refreshTokenHash -emailVerificationTokenHash')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    User.countDocuments(query)
  ]);

  return {
    users,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum)
  };
};

/**
 * Returns detailed single user profile including addresses and seller info.
 */
const getUserById = async (userId) => {
  const user = await User.findById(userId)
    .select('-password -refreshTokenHash -emailVerificationTokenHash')
    .lean();

  if (!user) {
    throw new ApiError(404, 'User account not found');
  }

  const [addresses, seller] = await Promise.all([
    Address.find({ user: userId }).lean(),
    Seller.findOne({ user: userId }).lean()
  ]);

  return {
    user,
    addresses,
    seller: seller || null
  };
};

/**
 * Blocks a user account and restricts seller operations if applicable.
 */
const blockUser = async (adminId, userId, req) => {
  if (adminId.toString() === userId.toString()) {
    throw new ApiError(400, 'Admin cannot block their own account');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User account not found');
  }

  user.isBlocked = true;
  await user.save();

  // If user is a seller, update seller profile status
  let sellerObj = null;
  if (user.role === 'seller') {
    sellerObj = await Seller.findOneAndUpdate(
      { user: userId },
      { verificationStatus: 'blocked' },
      { new: true }
    );
  }

  await logAdminAction({
    adminId,
    action: 'USER_BLOCKED',
    targetType: 'User',
    targetId: userId,
    metadata: { email: user.email, role: user.role },
    req
  });

  return {
    message: 'User account blocked successfully',
    user,
    seller: sellerObj
  };
};

/**
 * Unblocks a user account and restores seller profile status if applicable.
 */
const unblockUser = async (adminId, userId, req) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User account not found');
  }

  user.isBlocked = false;
  await user.save();

  let sellerObj = null;
  if (user.role === 'seller') {
    sellerObj = await Seller.findOneAndUpdate(
      { user: userId },
      { verificationStatus: 'approved' },
      { new: true }
    );
  }

  await logAdminAction({
    adminId,
    action: 'USER_UNBLOCKED',
    targetType: 'User',
    targetId: userId,
    metadata: { email: user.email, role: user.role },
    req
  });

  return {
    message: 'User account unblocked successfully',
    user,
    seller: sellerObj
  };
};

/**
 * Updates a user's role with strict admin protection rules.
 */
const updateUserRole = async (adminId, userId, newRole, req) => {
  const validRoles = ['customer', 'seller', 'admin'];
  if (!validRoles.includes(newRole)) {
    throw new ApiError(400, `Invalid role '${newRole}'. Allowed roles: ${validRoles.join(', ')}`);
  }

  if (adminId.toString() === userId.toString()) {
    throw new ApiError(400, 'Admin cannot demote or change their own role');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User account not found');
  }

  // Prevent demoting the last active admin
  if (user.role === 'admin' && newRole !== 'admin') {
    const activeAdminCount = await User.countDocuments({ role: 'admin', isBlocked: false });
    if (activeAdminCount <= 1) {
      throw new ApiError(400, 'Cannot demote the last active admin account');
    }
  }

  const previousRole = user.role;
  user.role = newRole;
  await user.save();

  await logAdminAction({
    adminId,
    action: 'USER_ROLE_CHANGED',
    targetType: 'User',
    targetId: userId,
    metadata: { email: user.email, previousRole, newRole },
    req
  });

  return {
    message: `User role updated from '${previousRole}' to '${newRole}'`,
    user
  };
};

module.exports = {
  getUsers,
  getUserById,
  blockUser,
  unblockUser,
  updateUserRole
};
