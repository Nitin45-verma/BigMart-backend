const express = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const adminPayoutController = require('../controllers/adminPayoutController');

const router = express.Router();

router.use(authenticate, authorizeRoles('admin'));

router.get('/', adminPayoutController.listPayouts);
router.get('/:payoutId', adminPayoutController.getPayout);
router.patch('/:payoutId/approve', adminPayoutController.approvePayout);
router.patch('/:payoutId/reject', adminPayoutController.rejectPayout);
router.patch('/:payoutId/process', adminPayoutController.processPayout);
router.patch('/:payoutId/complete', adminPayoutController.completePayout);
router.patch('/:payoutId/fail', adminPayoutController.failPayout);

module.exports = router;
