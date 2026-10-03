const adminDashboardService = require('../services/adminDashboardService');

/**
 * GET /api/v1/admin/dashboard/summary
 * Returns marketplace summary metrics.
 */
const getSummary = async (req, res, next) => {
  try {
    const summary = await adminDashboardService.getAdminDashboardSummary();
    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSummary
};
