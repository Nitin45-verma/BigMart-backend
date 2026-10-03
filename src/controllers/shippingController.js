const shippingService = require('../services/shippingService');

/**
 * Customer: Get multi-vendor distance-based shipping quote
 */
const getShippingQuote = async (req, res, next) => {
  try {
    const { addressId } = req.body;
    const quote = await shippingService.getShippingQuote(req.user.userId, addressId);
    res.status(200).json({
      success: true,
      data: quote
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getShippingQuote
};
