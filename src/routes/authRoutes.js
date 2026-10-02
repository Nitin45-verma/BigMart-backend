const express = require('express');
const passport = require('passport');
const authController = require('../controllers/authController');
const { validateRegisterInput, validateLoginInput } = require('../validators/authValidator');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * @route POST /api/v1/auth/register
 * @desc Register a new user and send verification email
 */
router.post('/register', validateRegisterInput, authController.register);

/**
 * @route GET /api/v1/auth/google
 * @desc Initiate Google OAuth 2.0 authentication with explicit scope
 */
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

/**
 * @route GET /api/v1/auth/google/callback
 * @desc Google OAuth 2.0 callback endpoint
 */
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login?error=OAuthFailed' }),
  authController.googleCallback
);

/**
 * @route GET /api/v1/auth/verify-email
 * @desc Verify user email address with query token
 */
router.get('/verify-email', authController.verifyEmail);

/**
 * @route POST /api/v1/auth/resend-verification
 * @desc Resend email verification link
 */
router.post('/resend-verification', authController.resendVerification);

/**
 * @route POST /api/v1/auth/login
 * @desc Authenticate user and issue tokens
 */
router.post('/login', validateLoginInput, authController.login);

/**
 * @route POST /api/v1/auth/refresh
 * @desc Refresh access token using HTTP-only refresh token cookie
 */
router.post('/refresh', authController.refresh);

/**
 * @route POST /api/v1/auth/logout
 * @desc Logout user and revoke refresh token cookie
 */
router.post('/logout', authController.logout);

/**
 * @route GET /api/v1/auth/me
 * @desc Get currently authenticated user details
 */
router.get('/me', authenticate, authController.getMe);

module.exports = router;
