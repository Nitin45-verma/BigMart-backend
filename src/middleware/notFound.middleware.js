const ApiError = require('../utils/ApiError');

/**
 * Handles 404 - Not Found for unhandled routes.
 */
const notFoundHandler = (req, res, next) => {
  const error = new ApiError(404, `Route not found: ${req.originalUrl}`);
  next(error);
};

module.exports = notFoundHandler;
