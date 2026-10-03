const adminAnalyticsService = require('../services/adminAnalyticsService');

const getSalesAnalytics = async (req, res, next) => {
  try {
    const analytics = await adminAnalyticsService.getSalesAnalytics(req.query);
    res.status(200).json({
      success: true,
      data: analytics
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSalesAnalytics
};
