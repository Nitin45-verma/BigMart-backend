const express = require('express');
const reviewController = require('../controllers/reviewController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

const router = express.Router();

// All seller review management routes require seller authentication
router.use(authenticate, authorizeRoles('seller'));

router.get('/', reviewController.getSellerReviews);
router.get('/:reviewId', reviewController.getSellerReviewById);
router.patch('/:reviewId/reply', reviewController.sellerReplyToReview);

module.exports = router;
