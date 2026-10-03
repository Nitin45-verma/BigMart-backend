const Address = require('../models/Address');
const Cart = require('../models/Cart');
const Seller = require('../models/Seller');
const Product = require('../models/Product');
const ApiError = require('../utils/ApiError');
const { calculateDistance, isValidCoordinates } = require('../utils/distanceUtils');
const { getDeliveryFeeForDistance } = require('../config/shippingConfig');

/**
 * Extracts valid geographic coordinates from a Seller document.
 * Checks root coordinates first, then pickupAddress, then businessAddress.
 */
const extractSellerCoordinates = (seller) => {
  if (!seller) return null;

  if (isValidCoordinates(seller.latitude, seller.longitude)) {
    return { latitude: Number(seller.latitude), longitude: Number(seller.longitude) };
  }
  if (seller.pickupAddress && isValidCoordinates(seller.pickupAddress.latitude, seller.pickupAddress.longitude)) {
    return { latitude: Number(seller.pickupAddress.latitude), longitude: Number(seller.pickupAddress.longitude) };
  }
  if (seller.businessAddress && isValidCoordinates(seller.businessAddress.latitude, seller.businessAddress.longitude)) {
    return { latitude: Number(seller.businessAddress.latitude), longitude: Number(seller.businessAddress.longitude) };
  }

  return null;
};

/**
 * Calculates multi-vendor shipping breakdown for a customer cart and selected address.
 */
const getShippingQuote = async (userId, addressId) => {
  // 1. Load & validate customer selected address
  const address = await Address.findOne({ _id: addressId, user: userId });
  if (!address) {
    throw new ApiError(400, 'Valid shipping address belonging to you is required');
  }

  if (!isValidCoordinates(address.latitude, address.longitude)) {
    throw new ApiError(400, 'Selected shipping address does not contain valid geographic coordinates');
  }

  const customerLat = Number(address.latitude);
  const customerLon = Number(address.longitude);

  // 2. Load customer's cart
  const cart = await Cart.findOne({ user: userId });
  if (!cart || !cart.items || cart.items.length === 0) {
    throw new ApiError(400, 'Cart is empty. Cannot calculate shipping quote for an empty cart');
  }

  // Identify all products & represented sellers in cart
  const productIds = cart.items.map((item) => item.product);
  const products = await Product.find({
    _id: { $in: productIds },
    status: 'active',
    isPublished: true
  });

  if (products.length === 0) {
    throw new ApiError(400, 'Cart is empty. Cannot calculate shipping quote for an empty cart');
  }

  // Group unique seller IDs
  const sellerIds = [...new Set(products.map((p) => p.seller.toString()))];

  const shippingBreakdown = [];
  let totalDeliveryFee = 0;

  for (const sellerId of sellerIds) {
    const seller = await Seller.findById(sellerId);
    if (!seller) {
      throw new ApiError(404, `Seller record not found for ID ${sellerId}`);
    }

    const sellerCoords = extractSellerCoordinates(seller);
    if (!sellerCoords) {
      throw new ApiError(
        400,
        `Seller '${seller.businessName}' location coordinates are unavailable. Cannot calculate delivery fee.`
      );
    }

    const distanceKm = calculateDistance(
      customerLat,
      customerLon,
      sellerCoords.latitude,
      sellerCoords.longitude
    );

    const billableDistanceKm = Math.ceil(distanceKm);
    const deliveryFee = getDeliveryFeeForDistance(billableDistanceKm);

    totalDeliveryFee += deliveryFee;

    shippingBreakdown.push({
      sellerId: seller._id,
      sellerName: seller.businessName,
      distanceKm,
      billableDistanceKm,
      deliveryFee
    });
  }

  return {
    addressId: address._id,
    shipping: shippingBreakdown,
    totalDeliveryFee
  };
};

module.exports = {
  extractSellerCoordinates,
  getShippingQuote
};
