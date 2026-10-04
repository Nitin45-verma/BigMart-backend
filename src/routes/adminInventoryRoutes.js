const express = require('express');
const inventoryController = require('../controllers/inventoryController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(authenticate);
router.use(authorizeRoles('admin'));

router.get('/', inventoryController.getAdminInventory);
router.get('/:productId/movements', inventoryController.getAdminMovements);

module.exports = router;
