const express = require('express');
const adminSellerController = require('../controllers/adminSellerController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { validateSellerIdParam } = require('../validators/adminValidator');

const router = express.Router();

router.use(authenticate, authorizeRoles('admin'));

router.get('/', adminSellerController.getSellers);
router.get('/:sellerId', validateSellerIdParam, adminSellerController.getSellerById);
router.patch('/:sellerId/block', validateSellerIdParam, adminSellerController.blockSeller);
router.patch('/:sellerId/unblock', validateSellerIdParam, adminSellerController.unblockSeller);
router.patch('/:sellerId/suspend', validateSellerIdParam, adminSellerController.suspendSeller);
router.patch('/:sellerId/reactivate', validateSellerIdParam, adminSellerController.reactivateSeller);

module.exports = router;

