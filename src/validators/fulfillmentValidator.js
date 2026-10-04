const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');

const validateMongoId = (id) => mongoose.Types.ObjectId.isValid(id);

const validateFulfillmentIdParam = (req, res, next) => {
  const { fulfillmentId } = req.params;
  if (!fulfillmentId || !validateMongoId(fulfillmentId)) {
    return next(new ApiError(400, 'Invalid fulfillment ID format'));
  }
  next();
};

const validateShipmentIdParam = (req, res, next) => {
  const { shipmentId } = req.params;
  if (!shipmentId || !validateMongoId(shipmentId)) {
    return next(new ApiError(400, 'Invalid shipment ID format'));
  }
  next();
};

const validateStatusUpdate = (req, res, next) => {
  const { status } = req.body;
  if (!status || typeof status !== 'string') {
    return next(new ApiError(400, 'Status is required as a string'));
  }
  next();
};

const validateCreateShipment = (req, res, next) => {
  const { provider } = req.body;
  if (!provider || typeof provider !== 'string') {
    return next(new ApiError(400, 'Provider is required as a string'));
  }
  
  // Protect against financial/sensitive data injection
  const prohibitedKeys = ['seller', 'order', 'fulfillment', 'price', 'shippingFee', 'payment', 'status', 'total'];
  for (const key of prohibitedKeys) {
    if (req.body[key] !== undefined) {
      return next(new ApiError(400, `Modification of '${key}' is prohibited during shipment creation`));
    }
  }

  next();
};

module.exports = {
  validateFulfillmentIdParam,
  validateShipmentIdParam,
  validateStatusUpdate,
  validateCreateShipment
};
