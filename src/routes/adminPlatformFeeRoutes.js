const express = require('express');
const adminPlatformFeeController = require('../controllers/adminPlatformFeeController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { validatePlatformFeeInput } = require('../validators/adminValidator');

const router = express.Router();

router.use(authenticate, authorizeRoles('admin'));

router.get('/', adminPlatformFeeController.getPlatformFees);
router.patch('/', validatePlatformFeeInput, adminPlatformFeeController.updatePlatformFee);

module.exports = router;
