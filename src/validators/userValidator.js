const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');

/**
 * Validates profile update fields and rejects attempts to modify protected fields.
 */
const validateProfileUpdate = (req, res, next) => {
  const protectedFields = [
    '_id',
    'id',
    'email',
    'role',
    'password',
    'isEmailVerified',
    'isBlocked',
    'authProvider',
    'googleId',
    'refreshTokenHash',
    'refreshTokenExpiresAt',
    'emailVerificationTokenHash',
    'emailVerificationExpiresAt',
    'createdAt',
    'updatedAt'
  ];

  // Check if client explicitly sent any protected field
  for (const field of protectedFields) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      return next(new ApiError(400, `Modifying field '${field}' is not allowed`));
    }
  }

  const { gender, dateOfBirth } = req.body;

  if (gender && !['male', 'female', 'other', 'prefer_not_to_say'].includes(gender)) {
    return next(new ApiError(400, 'Invalid gender value'));
  }

  if (dateOfBirth && isNaN(Date.parse(dateOfBirth))) {
    return next(new ApiError(400, 'Invalid date of birth format'));
  }

  next();
};

/**
 * Validates Indian PIN code format (6 digits, not starting with 0).
 */
const isValidIndianPinCode = (pin) => {
  const pinRegex = /^[1-9][0-9]{5}$/;
  return typeof pin === 'string' && pinRegex.test(pin.trim());
};

/**
 * Validates address creation and update request body.
 */
const validateAddressInput = (isUpdate = false) => {
  return (req, res, next) => {
    const { fullName, addressLine1, city, state, postalCode, country, addressType } = req.body;

    if (!isUpdate) {
      if (!fullName || typeof fullName !== 'string' || fullName.trim().length === 0) {
        return next(new ApiError(400, 'Full name is required'));
      }
      if (!addressLine1 || typeof addressLine1 !== 'string' || addressLine1.trim().length === 0) {
        return next(new ApiError(400, 'Address line 1 is required'));
      }
      if (!city || typeof city !== 'string' || city.trim().length === 0) {
        return next(new ApiError(400, 'City is required'));
      }
      if (!state || typeof state !== 'string' || state.trim().length === 0) {
        return next(new ApiError(400, 'State is required'));
      }
      if (!postalCode || typeof postalCode !== 'string' || postalCode.trim().length === 0) {
        return next(new ApiError(400, 'Postal code is required'));
      }
    }

    const countryValue = (country || 'India').trim();

    // Validate Indian PIN code if country is India
    if (countryValue.toLowerCase() === 'india' && postalCode) {
      if (!isValidIndianPinCode(postalCode)) {
        return next(new ApiError(400, 'Invalid Indian postal code (PIN code must be 6 digits)'));
      }
    }

    if (addressType && !['home', 'work', 'other'].includes(addressType)) {
      return next(new ApiError(400, 'Invalid address type'));
    }

    next();
  };
};

/**
 * Validates Mongo ObjectId parameter for address ID.
 */
const validateAddressId = (req, res, next) => {
  const { addressId } = req.params;
  if (!addressId || !mongoose.Types.ObjectId.isValid(addressId)) {
    return next(new ApiError(400, 'Invalid address ID format'));
  }
  next();
};

module.exports = {
  validateProfileUpdate,
  validateAddressInput,
  validateAddressId
};
