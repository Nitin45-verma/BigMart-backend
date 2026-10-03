const express = require('express');
const reviewController = require('../controllers/reviewController');
const { authenticate, optionalAuthenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { requireEmailVerified } = require('../middleware/verificationMiddleware');

const router = express.Router();

// Customer product review submission
router.post(
  '/products/:productId/reviews',
  authenticate,
  authorizeRoles('customer'),
  requireEmailVerified,
  reviewController.createReview
);

// Public product reviews list
router.get('/products/:productId/reviews', reviewController.getPublicProductReviews);

// Public/Customer single review view
router.get('/reviews/:reviewId', optionalAuthenticate, reviewController.getReviewById);

// Customer review management
router.patch(
  '/reviews/:reviewId',
  authenticate,
  authorizeRoles('customer'),
  requireEmailVerified,
  reviewController.updateCustomerReview
);

router.delete(
  '/reviews/:reviewId',
  authenticate,
  authorizeRoles('customer'),
  requireEmailVerified,
  reviewController.deleteCustomerReview
);

// Customer report review
router.post(
  '/reviews/:reviewId/report',
  authenticate,
  authorizeRoles('customer'),
  requireEmailVerified,
  reviewController.reportReview
);

module.exports = router;
