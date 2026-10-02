const ApiError = require('../utils/ApiError');

/**
 * Basic email regex validator.
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return typeof email === 'string' && emailRegex.test(email.trim());
};

/**
 * Validates registration request body.
 */
const validateRegisterInput = (req, res, next) => {
  const { name, email, password } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return next(new ApiError(400, 'Name is required'));
  }

  if (!email || !isValidEmail(email)) {
    return next(new ApiError(400, 'A valid email address is required'));
  }

  if (!password || typeof password !== 'string') {
    return next(new ApiError(400, 'Password is required'));
  }

  if (password.length < 8) {
    return next(new ApiError(400, 'Password must be at least 8 characters long'));
  }

  next();
};

/**
 * Validates login request body.
 */
const validateLoginInput = (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !isValidEmail(email)) {
    return next(new ApiError(400, 'A valid email address is required'));
  }

  if (!password || typeof password !== 'string' || password.length === 0) {
    return next(new ApiError(400, 'Password is required'));
  }

  next();
};

module.exports = {
  validateRegisterInput,
  validateLoginInput
};
