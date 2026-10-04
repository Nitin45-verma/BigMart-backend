const express = require('express');
const inventoryController = require('../controllers/inventoryController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { authorizeSeller } = require('../middleware/sellerMiddleware');
const {
  validateInventoryList,
  validateStockIn,
  validateStockOut,
  validateAdjust,
  validateThreshold
} = require('../validators/inventoryValidator');

const router = express.Router();

router.use(authenticate);
router.use(authorizeRoles('seller'));
router.use(authorizeSeller);

router.get('/', validateInventoryList, inventoryController.getSellerInventory);
router.post('/:productId/stock-in', validateStockIn, inventoryController.stockIn);
router.post('/:productId/stock-out', validateStockOut, inventoryController.stockOut);
router.post('/:productId/adjust', validateAdjust, inventoryController.adjustStock);
router.patch('/:productId/threshold', validateThreshold, inventoryController.updateThreshold);
router.get('/:productId/movements', inventoryController.getMovements);

module.exports = router;
