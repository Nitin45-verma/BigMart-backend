const express = require('express');
const fulfillmentController = require('../controllers/fulfillmentController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(authenticate, authorizeRoles('admin'));

router.get('/', fulfillmentController.getAdminFulfillments);

module.exports = router;
