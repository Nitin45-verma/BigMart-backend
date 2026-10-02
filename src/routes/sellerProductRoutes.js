const express = require('express');
const productController = require('../controllers/productController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { validateProductInput, validateProductIdParam } = require('../validators/productValidator');

const router = express.Router();

// All seller product routes require authentication and seller role
router.use(authenticate, authorizeRoles('seller'));

router.post('/', validateProductInput, productController.createProduct);
router.get('/', productController.getSellerProducts);
router.get('/:productId', validateProductIdParam, productController.getSellerProductById);
router.patch('/:productId', validateProductIdParam, validateProductInput, productController.updateSellerProduct);
router.delete('/:productId', validateProductIdParam, productController.deleteSellerProduct);

module.exports = router;
