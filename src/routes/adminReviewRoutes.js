const express = require('express');
const reviewController = require('../controllers/reviewController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

const router = express.Router();

// All admin review moderation routes require admin authentication
router.use(authenticate, authorizeRoles('admin'));

router.get('/', reviewController.getAdminReviews);
router.get('/:reviewId', reviewController.getAdminReviewById);
router.patch('/:reviewId/status', reviewController.updateAdminReviewStatus);
router.delete('/:reviewId', reviewController.deleteAdminReview);

module.exports = router;
