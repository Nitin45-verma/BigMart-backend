const express = require('express');
const orderController = require('../controllers/orderController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { requireEmailVerified } = require('../middleware/verificationMiddleware');
const returnController = require('../controllers/returnController');
const shipmentController = require('../controllers/shipmentController');
const {
  validateCheckoutInput,
  validateOrderIdParam,
  validateCancelOrderInput
} = require('../validators/orderValidator');
const {
  validateCreateReturnInput,
  validateReturnIdParam
} = require('../validators/returnValidator');

const router = express.Router();

// Order routes require authentication, customer role, and verified email
router.use(authenticate, authorizeRoles('customer'), requireEmailVerified);

router.post('/', validateCheckoutInput, orderController.createOrder);
router.get('/', orderController.getUserOrders);
router.get('/returns', returnController.getCustomerReturns);
router.get('/returns/:returnId', validateReturnIdParam, returnController.getCustomerReturnById);
router.get('/:orderId', validateOrderIdParam, orderController.getOrderById);
router.get('/:orderId/tracking', validateOrderIdParam, shipmentController.getOrderTracking);
router.patch('/:orderId/cancel', validateOrderIdParam, validateCancelOrderInput, orderController.cancelOrder);
router.post('/:orderId/returns', validateOrderIdParam, validateCreateReturnInput, returnController.createReturnRequest);

module.exports = router;

