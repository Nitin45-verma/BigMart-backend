const userService = require('../services/userService');

/**
 * Controller: GET /api/v1/users/me
 * Retrieves current authenticated user profile
 */
const getProfile = async (req, res, next) => {
  try {
    const user = await userService.getUserProfile(req.user.userId);
    res.status(200).json({
      success: true,
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: PATCH /api/v1/users/me
 * Updates current authenticated user profile
 */
const updateProfile = async (req, res, next) => {
  try {
    const user = await userService.updateUserProfile(req.user.userId, req.body);
    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: GET /api/v1/users/me/addresses
 * Retrieves saved addresses for authenticated user
 */
const getAddresses = async (req, res, next) => {
  try {
    const addresses = await userService.getUserAddresses(req.user.userId);
    res.status(200).json({
      success: true,
      data: { addresses }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: POST /api/v1/users/me/addresses
 * Creates a new address for authenticated user
 */
const createAddress = async (req, res, next) => {
  try {
    const address = await userService.createAddress(req.user.userId, req.body);
    res.status(201).json({
      success: true,
      message: 'Address created successfully',
      data: { address }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: PATCH /api/v1/users/me/addresses/:addressId
 * Updates an address owned by authenticated user
 */
const updateAddress = async (req, res, next) => {
  try {
    const address = await userService.updateAddress(req.user.userId, req.params.addressId, req.body);
    res.status(200).json({
      success: true,
      message: 'Address updated successfully',
      data: { address }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: DELETE /api/v1/users/me/addresses/:addressId
 * Deletes an address owned by authenticated user
 */
const deleteAddress = async (req, res, next) => {
  try {
    const result = await userService.deleteAddress(req.user.userId, req.params.addressId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: PATCH /api/v1/users/me/addresses/:addressId/default
 * Sets an address as default for authenticated user
 */
const setDefaultAddress = async (req, res, next) => {
  try {
    const address = await userService.setDefaultAddress(req.user.userId, req.params.addressId);
    res.status(200).json({
      success: true,
      message: 'Default address updated successfully',
      data: { address }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress
};
