const express = require('express');
const wishlistController = require('../controllers/wishlistController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { requireEmailVerified } = require('../middleware/verificationMiddleware');
const {
  validateAddToWishlistInput,
  validateProductIdParam,
  validatePaginationParams
} = require('../validators/wishlistValidator');

const router = express.Router();

router.use(authenticate, authorizeRoles('customer'), requireEmailVerified);

router.get('/', validatePaginationParams, wishlistController.getWishlist);
router.get('/count', wishlistController.getWishlistCount);
router.get('/check/:productId', validateProductIdParam, wishlistController.checkProductWishlistStatus);
router.post('/items', validateAddToWishlistInput, wishlistController.addItemToWishlist);
router.delete('/items/:productId', validateProductIdParam, wishlistController.removeItemFromWishlist);
router.delete('/', wishlistController.clearWishlist);
router.post('/items/:productId/move-to-cart', validateProductIdParam, wishlistController.moveItemToCart);

module.exports = router;
