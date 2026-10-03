const ApiError = require('../utils/ApiError');
const { verifyAccessToken } = require('../utils/tokenUtils');

/**
 * Authentication Middleware: Verifies Bearer JWT access token
 * and attaches user info (userId, role) to req.user.
 */
const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(401, 'Authentication token is missing');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new ApiError(401, 'Authentication token is missing');
    }

    const decoded = verifyAccessToken(token);

    req.user = {
      userId: decoded.userId,
      role: decoded.role
    };

    next();
  } catch (error) {
    if (error instanceof ApiError) {
      return next(error);
    }
    // Handle JWT errors (TokenExpiredError, JsonWebTokenError) cleanly
    return next(new ApiError(401, 'Invalid or expired token'));
  }
};

/**
 * Optional Authentication Middleware: Attaches req.user if valid token provided, otherwise continues
 */
const optionalAuthenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (token) {
        const decoded = verifyAccessToken(token);
        req.user = {
          userId: decoded.userId,
          role: decoded.role
        };
      }
    }
  } catch (error) {
    // Ignore invalid tokens for optional auth
  }
  next();
};

module.exports = {
  authenticate,
  optionalAuthenticate
};
