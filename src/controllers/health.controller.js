/**
 * Health check controller.
 * Returns operational status, environment name, and server timestamp.
 */
const getHealthStatus = (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is running',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  getHealthStatus
};
