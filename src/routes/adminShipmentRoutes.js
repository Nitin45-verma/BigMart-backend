const express = require('express');
const shipmentController = require('../controllers/shipmentController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { validateShipmentIdParam, validateStatusUpdate } = require('../validators/fulfillmentValidator');

const router = express.Router();

router.use(authenticate, authorizeRoles('admin'));

router.get('/', shipmentController.getAdminShipments);
router.get('/:shipmentId', validateShipmentIdParam, shipmentController.getShipmentById);
router.patch('/:shipmentId/status', validateShipmentIdParam, validateStatusUpdate, shipmentController.updateShipmentStatus);

module.exports = router;
