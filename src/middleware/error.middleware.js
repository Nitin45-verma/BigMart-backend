const ApiError = require('../utils/ApiError');

/**
 * Centralized error handling middleware.
 * Ensures consistent JSON error response and hides sensitive details in production.
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Something went wrong';

  // In production, mask unhandled non-operational internal errors
  if (process.env.NODE_ENV === 'production' && !err.isOperational) {
    statusCode = 500;
    message = 'Something went wrong';
  }

  const response = {
    success: false,
    message
  };

  if (process.env.NODE_ENV === 'development') {
    console.error(`[Error ${statusCode}] ${err.stack || message}`);
  }

  res.status(statusCode).json(response);
};

module.exports = errorHandler;
