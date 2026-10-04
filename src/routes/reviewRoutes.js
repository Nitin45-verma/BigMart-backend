const express = require('express');
const reviewController = require('../controllers/reviewController');
const { authenticate, optionalAuthenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { requireEmailVerified } = require('../middleware/verificationMiddleware');

const router = express.Router();

// Public/Customer single review view
router.get('/:reviewId', optionalAuthenticate, reviewController.getReviewById);

// Customer review management
router.patch(
  '/:reviewId',
  authenticate,
  authorizeRoles('customer'),
  requireEmailVerified,
  reviewController.updateCustomerReview
);

router.delete(
  '/:reviewId',
  authenticate,
  authorizeRoles('customer'),
  requireEmailVerified,
  reviewController.deleteCustomerReview
);

// Customer report review
router.post(
  '/:reviewId/report',
  authenticate,
  authorizeRoles('customer'),
  requireEmailVerified,
  reviewController.reportReview
);

module.exports = router;
