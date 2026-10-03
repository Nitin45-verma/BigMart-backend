const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');

/**
 * Validates shipping quote request payload.
 * Guards against client-supplied shipping fee or distance tampering.
 */
const validateShippingQuoteInput = (req, res, next) => {
  const protectedFields = [
    'deliveryFee',
    'shippingTotal',
    'totalDeliveryFee',
    'distanceKm',
    'billableDistanceKm',
    'sellerShippingFee',
    'shipping'
  ];

  for (const field of protectedFields) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      return next(new ApiError(400, `Setting field '${field}' is not allowed in shipping quote payload`));
    }
  }

  const { addressId } = req.body;

  if (!addressId || !mongoose.Types.ObjectId.isValid(addressId)) {
    return next(new ApiError(400, 'Valid shipping address ID is required'));
  }

  next();
};

module.exports = {
  validateShippingQuoteInput
};
