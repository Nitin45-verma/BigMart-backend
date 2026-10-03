const express = require('express');
const returnController = require('../controllers/returnController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { validateReturnIdParam, validateRejectReturnInput } = require('../validators/returnValidator');

const router = express.Router();

// Admin return routes require authentication and admin role
router.use(authenticate, authorizeRoles('admin'));

router.get('/', returnController.getAdminReturns);
router.get('/:returnId', validateReturnIdParam, returnController.getAdminReturnById);
router.patch('/:returnId/approve', validateReturnIdParam, returnController.approveAdminReturn);
router.patch('/:returnId/reject', validateReturnIdParam, validateRejectReturnInput, returnController.rejectAdminReturn);
router.patch('/:returnId/refund', validateReturnIdParam, returnController.processRefund);

module.exports = router;
