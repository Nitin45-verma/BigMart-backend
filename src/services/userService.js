const User = require('../models/User');
const Address = require('../models/Address');
const ApiError = require('../utils/ApiError');

/**
 * Retrieves the current authenticated user's profile.
 */
const getUserProfile = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  return {
    id: user._id,
    name: user.name,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    avatar: user.avatar,
    dateOfBirth: user.dateOfBirth,
    gender: user.gender,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
};

/**
 * Updates editable profile information for the authenticated user.
 */
const updateUserProfile = async (userId, updateData) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const editableFields = ['name', 'firstName', 'lastName', 'avatar', 'dateOfBirth', 'gender'];
  for (const field of editableFields) {
    if (updateData[field] !== undefined) {
      user[field] = updateData[field];
    }
  }

  // If firstName or lastName was updated, update combined name if appropriate
  if (updateData.firstName || updateData.lastName) {
    const fn = user.firstName || '';
    const ln = user.lastName || '';
    if (fn || ln) {
      user.name = `${fn} ${ln}`.trim();
    }
  }

  await user.save();

  return {
    id: user._id,
    name: user.name,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    avatar: user.avatar,
    dateOfBirth: user.dateOfBirth,
    gender: user.gender,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
};

/**
 * Retrieves all saved addresses for the authenticated user.
 */
const getUserAddresses = async (userId) => {
  return await Address.find({ user: userId }).sort({ isDefault: -1, updatedAt: -1 });
};

/**
 * Creates a new address for the authenticated user.
 * Automatically marks first address as default.
 */
const createAddress = async (userId, addressData) => {
  const addressCount = await Address.countDocuments({ user: userId });

  let isDefault = addressData.isDefault;

  // First address is automatically default
  if (addressCount === 0) {
    isDefault = true;
  }

  // If new address is set to default, clear default flag on other addresses
  if (isDefault) {
    await Address.updateMany({ user: userId }, { isDefault: false });
  }

  const newAddress = await Address.create({
    ...addressData,
    user: userId,
    isDefault: !!isDefault
  });

  return newAddress;
};

/**
 * Updates an existing address owned by the authenticated user.
 */
const updateAddress = async (userId, addressId, updateData) => {
  const address = await Address.findOne({ _id: addressId, user: userId });
  if (!address) {
    throw new ApiError(404, 'Address not found');
  }

  if (updateData.isDefault === true && !address.isDefault) {
    await Address.updateMany({ user: userId }, { isDefault: false });
  }

  Object.assign(address, updateData);
  await address.save();

  return address;
};

/**
 * Deletes an address owned by the authenticated user.
 * Promotes another address to default if default address is deleted.
 */
const deleteAddress = async (userId, addressId) => {
  const address = await Address.findOne({ _id: addressId, user: userId });
  if (!address) {
    throw new ApiError(404, 'Address not found');
  }

  const wasDefault = address.isDefault;
  await Address.deleteOne({ _id: addressId, user: userId });

  // Fallback: If deleted address was default, promote the most recently updated remaining address
  if (wasDefault) {
    const remaining = await Address.find({ user: userId }).sort({ updatedAt: -1 });
    if (remaining.length > 0) {
      remaining[0].isDefault = true;
      await remaining[0].save();
    }
  }

  return { success: true, message: 'Address deleted successfully' };
};

/**
 * Sets a specific address as the default address for the authenticated user.
 */
const setDefaultAddress = async (userId, addressId) => {
  const address = await Address.findOne({ _id: addressId, user: userId });
  if (!address) {
    throw new ApiError(404, 'Address not found');
  }

  await Address.updateMany({ user: userId }, { isDefault: false });

  address.isDefault = true;
  await address.save();

  return address;
};

module.exports = {
  getUserProfile,
  updateUserProfile,
  getUserAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress
};
