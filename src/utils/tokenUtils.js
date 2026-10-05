const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * Generates JWT access token containing minimal payload (userId, role).
 */
const generateAccessToken = (user) => {
  const secret = process.env.JWT_ACCESS_SECRET || 'default_dev_access_secret_change_me';
  const expiresIn = process.env.JWT_ACCESS_EXPIRES_IN || '15m';

  return jwt.sign(
    {
      userId: user._id.toString(),
      role: user.role
    },
    secret,
    { expiresIn }
  );
};

/**
 * Verifies a JWT access token.
 */
const verifyAccessToken = (token) => {
  const secret = process.env.JWT_ACCESS_SECRET || 'default_dev_access_secret_change_me';
  return jwt.verify(token, secret, { algorithms: ['HS256'] });
};

/**
 * Generates a random raw refresh token string.
 */
const generateRefreshToken = () => {
  return crypto.randomBytes(40).toString('hex');
};

/**
 * Hashes a raw refresh token using SHA-256 before storing in database.
 */
const hashRefreshToken = (rawToken) => {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
};

/**
 * Generates a random raw email verification token string.
 */
const generateEmailVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Hashes a raw email verification token using SHA-256.
 */
const hashEmailVerificationToken = (rawToken) => {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
};

/**
 * Returns HTTP-only cookie options for setting the refresh token.
 */
const getRefreshTokenCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  // 7 days in milliseconds
  const maxAge = 7 * 24 * 60 * 60 * 1000;

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    maxAge,
    path: '/api/v1/auth'
  };
};

module.exports = {
  generateAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  generateEmailVerificationToken,
  hashEmailVerificationToken,
  getRefreshTokenCookieOptions
};
