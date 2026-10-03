const { roundMoney } = require('../utils/moneyUtils');

/**
 * Default server-controlled platform fee percentage configuration by business type.
 * Values represent fractional rates (0.05 = 5%).
 */
const DEFAULT_PLATFORM_FEE_RATES = {
  individual: 0.05,
  small_business: 0.06,
  medium_business: 0.07,
  large_business: 0.08,
  enterprise: 0.10,
  proprietorship: 0.05,
  partnership: 0.06,
  private_limited: 0.07,
  llp: 0.07,
  other: 0.05
};

// In-memory cache for dynamic DB overrides
const dynamicRatesCache = new Map();

/**
 * Sets or updates a dynamic rate override in memory.
 */
const setDynamicFeeRate = (businessType, rate) => {
  const normalizedType = String(businessType).toLowerCase();
  const rateFraction = rate > 1 ? rate / 100 : rate;
  dynamicRatesCache.set(normalizedType, rateFraction);
};

/**
 * Synchronously or asynchronously resolves active platform fee rates.
 */
const getAllFeeRatesSync = () => {
  const result = { ...DEFAULT_PLATFORM_FEE_RATES };
  dynamicRatesCache.forEach((rate, type) => {
    result[type] = rate;
  });
  return result;
};

/**
 * Resolves the platform fee rate for a given seller.
 * @param {Object} seller Seller mongoose document or plain object
 * @returns {number} Fractional fee rate (e.g., 0.06)
 */
const getSellerPlatformFeeRate = (seller) => {
  if (!seller) return 0.05;

  // 1. Explicit seller platform fee rate overriding config
  if (typeof seller.platformFeeRate === 'number' && seller.platformFeeRate >= 0) {
    return seller.platformFeeRate > 1 ? seller.platformFeeRate / 100 : seller.platformFeeRate;
  }

  // 2. Seller plan platform fee rate
  if (seller.sellerPlan && typeof seller.sellerPlan.platformFeeRate === 'number') {
    const rate = seller.sellerPlan.platformFeeRate;
    return rate > 1 ? rate / 100 : rate;
  }

  // 3. Dynamic or default rate based on seller.businessType
  const businessType = seller.businessType ? String(seller.businessType).toLowerCase() : null;
  if (businessType) {
    if (dynamicRatesCache.has(businessType)) {
      return dynamicRatesCache.get(businessType);
    }
    if (DEFAULT_PLATFORM_FEE_RATES[businessType] !== undefined) {
      return DEFAULT_PLATFORM_FEE_RATES[businessType];
    }
  }

  return 0.05;
};

/**
 * Calculates platform fee amount for an item revenue total.
 * @param {number} itemTotal 
 * @param {number} feeRate 
 * @returns {number} Rounded platform fee amount
 */
const calculateItemPlatformFee = (itemTotal, feeRate) => {
  if (!itemTotal || itemTotal <= 0) return 0;
  return roundMoney(itemTotal * feeRate);
};

module.exports = {
  DEFAULT_PLATFORM_FEE_RATES,
  setDynamicFeeRate,
  getAllFeeRatesSync,
  getSellerPlatformFeeRate,
  calculateItemPlatformFee
};
