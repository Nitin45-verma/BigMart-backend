const express = require('express');
const adminOrderController = require('../controllers/adminOrderController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { validateOrderIdParam, validateOrderStatusInput } = require('../validators/adminValidator');

const router = express.Router();

router.use(authenticate, authorizeRoles('admin'));

router.get('/', adminOrderController.getOrders);
router.get('/:orderId', validateOrderIdParam, adminOrderController.getOrderById);
router.patch('/:orderId/status', validateOrderIdParam, validateOrderStatusInput, adminOrderController.updateOrderStatus);

module.exports = router;
