const express = require('express');
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/authMiddleware');
const {
  validateProfileUpdate,
  validateAddressInput,
  validateAddressId
} = require('../validators/userValidator');

const router = express.Router();

// Apply authentication middleware to all user routes
router.use(authenticate);

/**
 * @route GET /api/v1/users/me
 * @desc  Get current authenticated user profile
 */
router.get('/me', userController.getProfile);

/**
 * @route PATCH /api/v1/users/me
 * @desc  Update current authenticated user profile
 */
router.patch('/me', validateProfileUpdate, userController.updateProfile);

/**
 * @route GET /api/v1/users/me/addresses
 * @desc  Get all addresses for authenticated user
 */
router.get('/me/addresses', userController.getAddresses);

/**
 * @route POST /api/v1/users/me/addresses
 * @desc  Create a new address for authenticated user
 */
router.post('/me/addresses', validateAddressInput(false), userController.createAddress);

/**
 * @route PATCH /api/v1/users/me/addresses/:addressId
 * @desc  Update an address owned by authenticated user
 */
router.patch(
  '/me/addresses/:addressId',
  validateAddressId,
  validateAddressInput(true),
  userController.updateAddress
);

/**
 * @route DELETE /api/v1/users/me/addresses/:addressId
 * @desc  Delete an address owned by authenticated user
 */
router.delete('/me/addresses/:addressId', validateAddressId, userController.deleteAddress);

/**
 * @route PATCH /api/v1/users/me/addresses/:addressId/default
 * @desc  Set an address as default for authenticated user
 */
router.patch('/me/addresses/:addressId/default', validateAddressId, userController.setDefaultAddress);

module.exports = router;
