const express = require('express');
const adminFinanceController = require('../controllers/adminFinanceController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(authenticate, authorizeRoles('admin'));

/**
 * @route GET /api/v1/admin/finance/summary
 * @desc  Platform-level financial summary from immutable order snapshots.
 * @query period=7d|30d|90d|all  (default 30d)
 * @query from, to               ISO date strings for custom range
 * @access Admin only
 */
router.get('/summary', adminFinanceController.getFinanceSummary);

module.exports = router;
