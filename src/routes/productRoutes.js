const express = require('express');
const productController = require('../controllers/productController');

const reviewController = require('../controllers/reviewController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { requireEmailVerified } = require('../middleware/verificationMiddleware');

const router = express.Router();

// Public product catalog endpoints (no authentication required)
router.get('/', productController.getPublicProducts);
router.get('/category/:categorySlug', productController.getPublicProductsByCategorySlug);

// Product Review endpoints
router.post(
  '/:productId/reviews',
  authenticate,
  authorizeRoles('customer'),
  requireEmailVerified,
  reviewController.createReview
);
router.get('/:productId/reviews', reviewController.getPublicProductReviews);

router.get('/:slug', productController.getPublicProductBySlug);

module.exports = router;
