const User = require('../models/User');
const ApiError = require('../utils/ApiError');

/**
 * Middleware: Requires that the authenticated user's email is verified.
 */
const requireEmailVerified = async (req, res, next) => {
  try {
    if (!req.user || !req.user.userId) {
      return next(new ApiError(401, 'Authentication required'));
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return next(new ApiError(404, 'User account not found'));
    }

    if (!user.isEmailVerified) {
      return next(new ApiError(403, 'Email verification is required before performing checkout or cart operations'));
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  requireEmailVerified
};
