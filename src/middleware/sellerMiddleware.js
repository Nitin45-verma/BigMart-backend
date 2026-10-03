const User = require('../models/User');
const Seller = require('../models/Seller');
const ApiError = require('../utils/ApiError');

/**
 * Reusable Seller Authorization Middleware for Seller Dashboard & APIs.
 * Enforces server-side identity derivation & approval check:
 * 1. Authenticated user token present (req.user)
 * 2. User email verified (user.isEmailVerified === true)
 * 3. User role === 'seller'
 * 4. Seller profile exists for user
 * 5. Seller verificationStatus === 'approved'
 */
const authorizeSeller = async (req, res, next) => {
  try {
    if (!req.user || !req.user.userId) {
      return next(new ApiError(401, 'Authentication required'));
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return next(new ApiError(401, 'User account not found'));
    }

    if (!user.isEmailVerified) {
      return next(new ApiError(403, 'Forbidden: Email verification is required to access seller dashboard'));
    }

    if (user.role !== 'seller') {
      return next(new ApiError(403, 'Forbidden: Only sellers are authorized to access this resource'));
    }

    const seller = await Seller.findOne({ user: user._id });
    if (!seller) {
      return next(new ApiError(403, 'Forbidden: Seller profile not found'));
    }

    if (seller.verificationStatus !== 'approved') {
      return next(new ApiError(403, 'Forbidden: Only approved sellers may access seller dashboard APIs'));
    }

    req.seller = seller;
    req.userDoc = user;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  authorizeSeller
};
