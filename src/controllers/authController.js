const authService = require('../services/authService');
const { getRefreshTokenCookieOptions } = require('../utils/tokenUtils');

/**
 * Controller: Handles user registration
 * POST /api/v1/auth/register
 */
const register = async (req, res, next) => {
  try {
    const userData = await authService.register(req.body);

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email to verify your account.',
      data: {
        user: userData
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Handles Google OAuth callback processing
 * GET /api/v1/auth/google/callback
 */
const googleCallback = async (req, res, next) => {
  try {
    const googleProfile = req.user;
    if (!googleProfile) {
      throw new Error('Google authentication failed: Profile not retrieved');
    }

    const { accessToken, rawRefreshToken, user } = await authService.handleGoogleAuth(googleProfile);

    // Set refresh token in secure HTTP-only cookie
    res.cookie('refreshToken', rawRefreshToken, getRefreshTokenCookieOptions());

    // If requested with json=true query parameter (e.g., during programmatic test calls)
    if (req.query.json === 'true') {
      return res.status(200).json({
        success: true,
        message: 'Google authentication successful',
        data: {
          accessToken,
          user
        }
      });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return res.redirect(`${frontendUrl}/oauth/success?token=${accessToken}`);
  } catch (error) {
    if (req.query.json === 'true') {
      return next(error);
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const errorMessage = encodeURIComponent(error.message || 'Google authentication failed');
    return res.redirect(`${frontendUrl}/login?error=${errorMessage}`);
  }
};

/**
 * Controller: Handles email verification
 * GET /api/v1/auth/verify-email?token=<token>
 */
const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.query;
    const result = await authService.verifyEmail(token);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Handles resending verification email
 * POST /api/v1/auth/resend-verification
 */
const resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;
    const result = await authService.resendVerification(email);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Handles user login
 * POST /api/v1/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { accessToken, rawRefreshToken, user } = await authService.login(req.body);

    // Set refresh token in HTTP-only cookie
    res.cookie('refreshToken', rawRefreshToken, getRefreshTokenCookieOptions());

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        accessToken,
        user
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Handles refresh token rotation
 * POST /api/v1/auth/refresh
 */
const refresh = async (req, res, next) => {
  try {
    const rawRefreshToken = req.cookies?.refreshToken;
    const { accessToken, newRawRefreshToken } = await authService.refreshTokens(rawRefreshToken);

    // Update HTTP-only cookie with rotated refresh token
    res.cookie('refreshToken', newRawRefreshToken, getRefreshTokenCookieOptions());

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Handles user logout
 * POST /api/v1/auth/logout
 */
const logout = async (req, res, next) => {
  try {
    const rawRefreshToken = req.cookies?.refreshToken;
    await authService.logout(rawRefreshToken);

    // Clear refresh token cookie
    res.clearCookie('refreshToken', getRefreshTokenCookieOptions());

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Returns currently authenticated user info
 * GET /api/v1/auth/me
 */
const getMe = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const user = await authService.getCurrentUser(userId);

    res.status(200).json({
      success: true,
      data: {
        user
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  googleCallback,
  verifyEmail,
  resendVerification,
  login,
  refresh,
  logout,
  getMe
};
