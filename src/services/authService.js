const bcrypt = require('bcryptjs');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const {
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  generateEmailVerificationToken,
  hashEmailVerificationToken
} = require('../utils/tokenUtils');
const emailService = require('./emailService');

const BCRYPT_SALT_ROUNDS = 12;

/**
 * Registers a new customer user and sends email verification.
 */
const register = async ({ name, email, password }) => {
  const normalizedEmail = email.toLowerCase().trim();

  // Check duplicate email
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw new ApiError(409, 'An account with this email already exists');
  }

  // Hash password using bcrypt
  const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

  // Generate verification token and expiry (30 mins)
  const rawToken = generateEmailVerificationToken();
  const hashedToken = hashEmailVerificationToken(rawToken);
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  // Create new user record
  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    password: hashedPassword,
    role: 'customer',
    authProvider: 'local',
    isEmailVerified: false,
    isBlocked: false,
    emailVerificationTokenHash: hashedToken,
    emailVerificationExpiresAt: expiresAt
  });

  // Attempt sending verification email
  try {
    await emailService.sendVerificationEmail({
      toEmail: user.email,
      userName: user.name,
      rawToken
    });
  } catch (emailError) {
    await User.findByIdAndDelete(user._id);
    console.error(`[AuthService] Email delivery failed on registration: ${emailError.message}`);
    throw new ApiError(500, 'Failed to send verification email. Please try registering again.');
  }

  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    isEmailVerified: user.isEmailVerified
  };
};

/**
 * Handles Google OAuth 2.0 user authentication/registration.
 */
const handleGoogleAuth = async (profile) => {
  const googleId = profile.id;
  const email = profile.emails?.[0]?.value?.toLowerCase().trim();
  const name = profile.displayName || profile.name?.givenName || 'Google User';
  const avatar = profile.photos?.[0]?.value;

  if (!email) {
    throw new ApiError(400, 'Google account does not provide an email address');
  }

  // 1. Search for existing user by googleId
  let user = await User.findOne({ googleId }).select('+refreshTokenHash +refreshTokenExpiresAt');

  if (user) {
    // Check if account is blocked
    if (user.isBlocked) {
      throw new ApiError(403, 'Your account has been blocked. Please contact support.');
    }
  } else {
    // 2. Check if an account with this email already exists under local auth
    const existingEmailUser = await User.findOne({ email });
    if (existingEmailUser) {
      throw new ApiError(
        409,
        'An account already exists with this email address. Please sign in using your existing email and password.'
      );
    }

    // 3. Create a new user for Google OAuth
    user = await User.create({
      name: name.trim(),
      email,
      avatar,
      googleId,
      authProvider: 'google',
      role: 'customer',
      isEmailVerified: true,
      isBlocked: false
    });
  }

  // Generate access & refresh tokens
  const accessToken = generateAccessToken(user);
  const rawRefreshToken = generateRefreshToken();
  const hashedRefreshToken = hashRefreshToken(rawRefreshToken);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  user.refreshTokenHash = hashedRefreshToken;
  user.refreshTokenExpiresAt = expiresAt;
  user.lastLoginAt = new Date();
  await user.save();

  return {
    accessToken,
    rawRefreshToken,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      isEmailVerified: user.isEmailVerified
    }
  };
};

/**
 * Verifies email address using raw token from query string.
 */
const verifyEmail = async (rawToken) => {
  if (!rawToken || typeof rawToken !== 'string') {
    throw new ApiError(400, 'Verification token is required');
  }

  const hashedToken = hashEmailVerificationToken(rawToken);

  const user = await User.findOne({
    emailVerificationTokenHash: hashedToken
  }).select('+emailVerificationTokenHash +emailVerificationExpiresAt');

  if (!user) {
    throw new ApiError(400, 'Verification link is invalid or has expired.');
  }

  if (user.isEmailVerified) {
    return { success: true, message: 'Email is already verified.' };
  }

  if (user.emailVerificationExpiresAt && user.emailVerificationExpiresAt < new Date()) {
    throw new ApiError(400, 'Verification link is invalid or has expired.');
  }

  user.isEmailVerified = true;
  user.emailVerificationTokenHash = undefined;
  user.emailVerificationExpiresAt = undefined;
  await user.save();

  return { success: true, message: 'Email verified successfully. You can now log in.' };
};

/**
 * Resends email verification email.
 */
const resendVerification = async (email) => {
  if (!email || typeof email !== 'string') {
    throw new ApiError(400, 'A valid email address is required');
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail }).select(
    '+emailVerificationTokenHash +emailVerificationExpiresAt'
  );

  if (!user) {
    return {
      success: true,
      message: 'If the account exists and requires verification, a verification email has been sent.'
    };
  }

  if (user.isEmailVerified) {
    return {
      success: true,
      message: 'Email is already verified.'
    };
  }

  const rawToken = generateEmailVerificationToken();
  const hashedToken = hashEmailVerificationToken(rawToken);
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  user.emailVerificationTokenHash = hashedToken;
  user.emailVerificationExpiresAt = expiresAt;
  await user.save();

  try {
    await emailService.sendVerificationEmail({
      toEmail: user.email,
      userName: user.name,
      rawToken
    });
  } catch (emailError) {
    console.error(`[AuthService] Email delivery failed on resend: ${emailError.message}`);
    throw new ApiError(500, 'Failed to resend verification email. Please try again later.');
  }

  return {
    success: true,
    message: 'If the account exists and requires verification, a verification email has been sent.'
  };
};

/**
 * Authenticates user credentials and generates access and refresh tokens.
 */
const login = async ({ email, password }) => {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await User.findOne({ email: normalizedEmail }).select(
    '+password +refreshTokenHash +refreshTokenExpiresAt'
  );

  if (!user) {
    throw new ApiError(401, 'Invalid email or password');
  }

  if (!user.password) {
    throw new ApiError(401, 'This account uses Google Sign-In. Please log in using Google.');
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new ApiError(401, 'Invalid email or password');
  }

  if (user.isBlocked) {
    throw new ApiError(403, 'Your account has been blocked. Please contact support.');
  }

  if (!user.isEmailVerified) {
    throw new ApiError(403, 'Please verify your email before logging in.');
  }

  const accessToken = generateAccessToken(user);
  const rawRefreshToken = generateRefreshToken();
  const hashedRefreshToken = hashRefreshToken(rawRefreshToken);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  user.refreshTokenHash = hashedRefreshToken;
  user.refreshTokenExpiresAt = expiresAt;
  user.lastLoginAt = new Date();
  await user.save();

  return {
    accessToken,
    rawRefreshToken,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified
    }
  };
};

/**
 * Rotates refresh token and returns a new access token.
 */
const refreshTokens = async (rawRefreshToken) => {
  if (!rawRefreshToken) {
    throw new ApiError(401, 'Refresh token is required');
  }

  const hashedToken = hashRefreshToken(rawRefreshToken);

  const user = await User.findOne({
    refreshTokenHash: hashedToken
  }).select('+refreshTokenHash +refreshTokenExpiresAt');

  if (!user) {
    throw new ApiError(401, 'Invalid or expired refresh token');
  }

  if (user.refreshTokenExpiresAt && user.refreshTokenExpiresAt < new Date()) {
    user.refreshTokenHash = undefined;
    user.refreshTokenExpiresAt = undefined;
    await user.save();
    throw new ApiError(401, 'Refresh token has expired');
  }

  if (user.isBlocked) {
    throw new ApiError(403, 'Your account has been blocked');
  }

  const newAccessToken = generateAccessToken(user);
  const newRawRefreshToken = generateRefreshToken();
  const newHashedRefreshToken = hashRefreshToken(newRawRefreshToken);

  const newExpiresAt = new Date();
  newExpiresAt.setDate(newExpiresAt.getDate() + 7);

  user.refreshTokenHash = newHashedRefreshToken;
  user.refreshTokenExpiresAt = newExpiresAt;
  await user.save();

  return {
    accessToken: newAccessToken,
    newRawRefreshToken
  };
};

/**
 * Logs out user by clearing stored refresh token.
 */
const logout = async (rawRefreshToken) => {
  if (rawRefreshToken) {
    const hashedToken = hashRefreshToken(rawRefreshToken);
    await User.updateOne(
      { refreshTokenHash: hashedToken },
      { $unset: { refreshTokenHash: 1, refreshTokenExpiresAt: 1 } }
    );
  }
};

/**
 * Retrieves profile details of currently authenticated user.
 */
const getCurrentUser = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
    isEmailVerified: user.isEmailVerified
  };
};

module.exports = {
  register,
  handleGoogleAuth,
  verifyEmail,
  resendVerification,
  login,
  refreshTokens,
  logout,
  getCurrentUser
};
