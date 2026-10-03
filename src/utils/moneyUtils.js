/**
 * Server-side money and precision utility.
 * Eliminates JavaScript floating-point arithmetic errors in financial calculations.
 */

/**
 * Rounds a rupee amount to exactly 2 decimal places.
 */
const roundMoney = (val) => {
  if (typeof val !== 'number' || isNaN(val)) return 0;
  return Math.round((val + Number.EPSILON) * 100) / 100;
};

/**
 * Converts a rupee amount to integer paise (smallest currency unit).
 * Example: ₹999.50 -> 99950 paise
 */
const toPaise = (rupees) => {
  if (typeof rupees !== 'number' || isNaN(rupees)) return 0;
  return Math.round((rupees + Number.EPSILON) * 100);
};

/**
 * Converts integer paise back to rupees rounded to 2 decimal places.
 */
const toRupees = (paise) => {
  if (typeof paise !== 'number' || isNaN(paise)) return 0;
  return Math.round(paise) / 100;
};

/**
 * Calculates GST breakdown for a GST-inclusive selling price.
 * Formula:
 *   Base Price = Selling Price / (1 + (GST Rate / 100))
 *   GST Amount = Selling Price - Base Price
 */
const calculateGST = (unitPrice, gstRate = 0) => {
  const price = roundMoney(unitPrice);
  const rate = typeof gstRate === 'number' && gstRate >= 0 ? gstRate : 0;

  if (rate === 0) {
    return {
      unitPrice: price,
      basePrice: price,
      gstAmount: 0
    };
  }

  const basePrice = roundMoney(price / (1 + rate / 100));
  const gstAmount = roundMoney(price - basePrice);

  return {
    unitPrice: price,
    basePrice,
    gstAmount
  };
};

module.exports = {
  roundMoney,
  toPaise,
  toRupees,
  calculateGST
};
