const express = require('express');
const fulfillmentController = require('../controllers/fulfillmentController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { authorizeSeller } = require('../middleware/sellerMiddleware');
const {
  validateFulfillmentIdParam,
  validateStatusUpdate,
  validateCreateShipment
} = require('../validators/fulfillmentValidator');

const router = express.Router();

router.use(authenticate, authorizeRoles('seller'), authorizeSeller);

router.get('/', fulfillmentController.getSellerFulfillments);
router.get('/:fulfillmentId', validateFulfillmentIdParam, fulfillmentController.getFulfillmentById);
router.patch('/:fulfillmentId/status', validateFulfillmentIdParam, validateStatusUpdate, fulfillmentController.updateFulfillmentStatus);
router.post('/:fulfillmentId/shipment', validateFulfillmentIdParam, validateCreateShipment, fulfillmentController.createShipment);
router.get('/:fulfillmentId/tracking', validateFulfillmentIdParam, fulfillmentController.getSellerTracking);

module.exports = router;
