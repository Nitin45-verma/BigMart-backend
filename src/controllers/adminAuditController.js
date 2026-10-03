const adminAuditService = require('../services/adminAuditService');

const getAuditLogs = async (req, res, next) => {
  try {
    const result = await adminAuditService.getAuditLogs(req.query);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAuditLogs
};
