/**
 * Centralized Marketplace Shipping & Delivery Fee Configuration.
 * Governs distance-based delivery tier calculations across multi-vendor checkouts.
 */
const shippingConfig = {
  currency: 'INR',

  // Distance tiers in kilometers
  tiers: [
    { maxKm: 5, fee: 40 },
    { maxKm: 10, fee: 60 },
    { maxKm: 20, fee: 90 },
    { maxKm: 30, fee: 130 }
  ],

  // Excess tier calculation beyond maximum defined tier
  excessTier: {
    baseKm: 30,
    baseFee: 130,
    additionalFeePerKm: 10
  }
};

/**
 * Calculates billable delivery fee based on billable distance in kilometers.
 */
const getDeliveryFeeForDistance = (billableDistanceKm) => {
  const dist = Math.max(0, Math.ceil(billableDistanceKm));

  for (const tier of shippingConfig.tiers) {
    if (dist <= tier.maxKm) {
      return tier.fee;
    }
  }

  // Beyond maximum defined tier (30 km)
  const excessKm = dist - shippingConfig.excessTier.baseKm;
  return shippingConfig.excessTier.baseFee + excessKm * shippingConfig.excessTier.additionalFeePerKm;
};

module.exports = {
  shippingConfig,
  getDeliveryFeeForDistance
};
