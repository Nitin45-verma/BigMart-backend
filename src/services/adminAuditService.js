const AdminAuditLog = require('../models/AdminAuditLog');

/**
 * Logs an administrative action to AdminAuditLog.
 * Sanitizes metadata to strictly prevent saving passwords, keys, or tokens.
 */
const logAdminAction = async ({ adminId, action, targetType, targetId, metadata = {}, req }) => {
  try {
    // Sanitize metadata to remove sensitive credentials
    const safeMetadata = { ...metadata };
    const sensitiveKeys = ['password', 'passwordHash', 'token', 'secret', 'key', 'apiKey', 'googleId', 'refreshToken'];
    
    Object.keys(safeMetadata).forEach((k) => {
      if (sensitiveKeys.some((s) => k.toLowerCase().includes(s.toLowerCase()))) {
        delete safeMetadata[k];
      }
    });

    let ipAddress = 'unknown';
    if (req) {
      ipAddress = req.ip || req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    }

    await AdminAuditLog.create({
      admin: adminId,
      action,
      targetType,
      targetId: targetId || null,
      metadata: safeMetadata,
      ipAddress
    });
  } catch (err) {
    // Audit logging failure should not break main execution flow, but log error
    console.error('Failed to record admin audit log:', err.message);
  }
};

/**
 * Fetches admin audit logs with pagination and filtering.
 */
const getAuditLogs = async ({ page = 1, limit = 20, admin, action, targetType, from, to }) => {
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const query = {};

  if (admin) query.admin = admin;
  if (action) query.action = action;
  if (targetType) query.targetType = targetType;

  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = new Date(from);
    if (to) query.createdAt.$lte = new Date(to);
  }

  const [logs, total] = await Promise.all([
    AdminAuditLog.find(query)
      .populate('admin', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    AdminAuditLog.countDocuments(query)
  ]);

  return {
    logs,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum)
  };
};

module.exports = {
  logAdminAction,
  getAuditLogs
};
