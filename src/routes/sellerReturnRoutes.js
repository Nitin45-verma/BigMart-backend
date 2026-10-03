const express = require('express');
const returnController = require('../controllers/returnController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeSeller } = require('../middleware/sellerMiddleware');
const { validateReturnIdParam, validateRejectReturnInput } = require('../validators/returnValidator');

const router = express.Router();

// Seller return routes require authentication and approved seller profile
router.use(authenticate, authorizeSeller);

router.get('/', returnController.getSellerReturns);
router.get('/:returnId', validateReturnIdParam, returnController.getSellerReturnById);
router.patch('/:returnId/approve', validateReturnIdParam, returnController.approveSellerReturn);
router.patch('/:returnId/reject', validateReturnIdParam, validateRejectReturnInput, returnController.rejectSellerReturn);

module.exports = router;
