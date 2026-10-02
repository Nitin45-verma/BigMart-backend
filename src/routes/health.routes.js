const express = require('express');
const { getHealthStatus } = require('../controllers/health.controller');

const router = express.Router();

/**
 * @route GET /api/v1/health
 * @desc  Health check endpoint
 * @access Public
 */
router.get('/', getHealthStatus);

module.exports = router;
