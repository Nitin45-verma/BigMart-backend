const express = require('express');
const adminProductController = require('../controllers/adminProductController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { validateProductIdParam } = require('../validators/adminValidator');

const router = express.Router();

router.use(authenticate, authorizeRoles('admin'));

router.get('/', adminProductController.getProducts);
router.get('/:productId', validateProductIdParam, adminProductController.getProductById);
router.patch('/:productId/status', validateProductIdParam, adminProductController.updateProductStatus);
router.patch('/:productId/publish', validateProductIdParam, adminProductController.publishProduct);
router.patch('/:productId/unpublish', validateProductIdParam, adminProductController.unpublishProduct);
router.patch('/:productId/archive', validateProductIdParam, adminProductController.archiveProduct);

module.exports = router;

