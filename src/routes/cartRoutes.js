const express = require('express');
const cartController = require('../controllers/cartController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { requireEmailVerified } = require('../middleware/verificationMiddleware');
const {
  validateAddToCartInput,
  validateUpdateCartItemInput,
  validateProductIdParam
} = require('../validators/cartValidator');

const router = express.Router();

// Cart routes require authentication, customer role, and verified email
router.use(authenticate, authorizeRoles('customer'), requireEmailVerified);

router.get('/', cartController.getCart);
router.post('/items', validateAddToCartInput, cartController.addItem);
router.patch('/items/:productId', validateProductIdParam, validateUpdateCartItemInput, cartController.updateItemQuantity);
router.delete('/items/:productId', validateProductIdParam, cartController.removeItem);
router.delete('/', cartController.clearCart);

module.exports = router;
