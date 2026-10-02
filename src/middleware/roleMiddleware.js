const ApiError = require('../utils/ApiError');

/**
 * Authorization Middleware: Enforces Role-Based Access Control (RBAC).
 * Accepts one or multiple allowed roles.
 * Example usage: authorizeRoles('admin') or authorizeRoles('seller', 'admin')
 */
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return next(new ApiError(401, 'Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ApiError(403, 'Forbidden: You do not have permission to access this resource')
      );
    }

    next();
  };
};

module.exports = {
  authorizeRoles
};
