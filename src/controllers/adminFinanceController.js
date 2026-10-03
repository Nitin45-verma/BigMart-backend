const adminFinanceService = require('../services/adminFinanceService');

/**
 * GET /api/v1/admin/finance/summary
 * Returns platform-level financial summary from DB order snapshots.
 * Supports period=7d|30d|90d|all and from/to date filters.
 * All values are server-calculated — no client-supplied financials trusted.
 */
const getFinanceSummary = async (req, res, next) => {
  try {
    const { period, from, to } = req.query;
    const summary = await adminFinanceService.getFinanceSummary({ period, from, to });
    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getFinanceSummary
};
