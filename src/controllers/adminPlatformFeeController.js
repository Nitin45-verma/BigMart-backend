const PlatformFeeConfig = require('../models/PlatformFeeConfig');
const { DEFAULT_PLATFORM_FEE_RATES, setDynamicFeeRate, getAllFeeRatesSync } = require('../config/platformFeeConfig');
const { logAdminAction } = require('../services/adminAuditService');

const getPlatformFees = async (req, res, next) => {
  try {
    const dbConfigs = await PlatformFeeConfig.find({}).lean();
    const rates = { ...DEFAULT_PLATFORM_FEE_RATES };

    dbConfigs.forEach((c) => {
      rates[c.businessType] = c.rate;
      setDynamicFeeRate(c.businessType, c.rate);
    });

    res.status(200).json({
      success: true,
      data: rates
    });
  } catch (error) {
    next(error);
  }
};

const updatePlatformFee = async (req, res, next) => {
  try {
    const { businessType, rate } = req.body;
    const normalizedType = String(businessType).toLowerCase();
    const numRate = Number(rate);
    const rateFraction = numRate > 1 ? numRate / 100 : numRate;

    const feeDoc = await PlatformFeeConfig.findOneAndUpdate(
      { businessType: normalizedType },
      { rate: rateFraction, updatedBy: req.user.userId },
      { new: true, upsert: true, runValidators: true }
    );

    // Update in-memory fee cache
    setDynamicFeeRate(normalizedType, rateFraction);

    await logAdminAction({
      adminId: req.user.userId,
      action: 'PLATFORM_FEE_CHANGED',
      targetType: 'PlatformFeeConfig',
      targetId: feeDoc._id,
      metadata: { businessType: normalizedType, newRate: rateFraction },
      req
    });

    res.status(200).json({
      success: true,
      message: `Platform fee rate for '${normalizedType}' updated to ${(rateFraction * 100).toFixed(2)}%`,
      data: {
        businessType: normalizedType,
        rate: rateFraction,
        allRates: getAllFeeRatesSync()
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPlatformFees,
  updatePlatformFee
};
