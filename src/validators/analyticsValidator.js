const validateAnalyticsQuery = (req, res, next) => {
  const { period, startDate, endDate, groupBy, format, limit, page } = req.query;

  if (period && !['today', 'yesterday', 'last7days', 'last30days', 'last90days', 'thisMonth', 'lastMonth', 'thisYear', 'custom'].includes(period)) {
    return res.status(400).json({ success: false, message: 'Invalid period preset' });
  }
  if (startDate && isNaN(new Date(startDate).getTime())) {
    return res.status(400).json({ success: false, message: 'Invalid startDate format' });
  }
  if (endDate && isNaN(new Date(endDate).getTime())) {
    return res.status(400).json({ success: false, message: 'Invalid endDate format' });
  }
  if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
    return res.status(400).json({ success: false, message: 'endDate cannot be before startDate' });
  }
  if (groupBy && !['daily', 'weekly', 'monthly'].includes(groupBy)) {
    return res.status(400).json({ success: false, message: 'Invalid groupBy value' });
  }
  if (format && !['json', 'csv'].includes(format)) {
    return res.status(400).json({ success: false, message: 'Invalid format' });
  }
  if (limit) {
    const l = parseInt(limit, 10);
    if (isNaN(l) || l < 1 || l > 100) return res.status(400).json({ success: false, message: 'Limit must be between 1 and 100' });
  }
  if (page) {
    const p = parseInt(page, 10);
    if (isNaN(p) || p < 1) return res.status(400).json({ success: false, message: 'Page must be a positive integer' });
  }

  next();
};

module.exports = {
  validateAnalyticsQuery
};
