const express = require('express');
const recommendationController = require('../controllers/recommendationController');
const {
  validateRecommendationQuery,
  validateProductIdParam,
  validateCategorySlugParam,
  validateSellerIdParam
} = require('../validators/recommendationValidator');
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

const router = express.Router();

// PUBLIC ROUTES (No Auth Required)
router.get('/new-arrivals', validateRecommendationQuery, recommendationController.getNewArrivals);
router.get('/trending', validateRecommendationQuery, recommendationController.getTrending);
router.get('/top-rated', validateRecommendationQuery, recommendationController.getTopRated);
router.get('/best-deals', validateRecommendationQuery, recommendationController.getBestDeals);
router.get('/related/:productId', validateProductIdParam, validateRecommendationQuery, recommendationController.getRelatedProducts);
router.get('/category/:categorySlug', validateCategorySlugParam, validateRecommendationQuery, recommendationController.getCategoryRecommendations);
router.get('/seller/:sellerId', validateSellerIdParam, validateRecommendationQuery, recommendationController.getSellerRecommendations);
router.get('/also-bought/:productId', validateProductIdParam, validateRecommendationQuery, recommendationController.getAlsoBought);

// AUTHENTICATED ROUTES (Customer Only)
router.use(authenticate);
router.use(authorizeRoles('customer'));

router.post('/recently-viewed/:productId', validateProductIdParam, recommendationController.recordProductView);
router.get('/recently-viewed', validateRecommendationQuery, recommendationController.getRecentlyViewed);
router.get('/from-wishlist', validateRecommendationQuery, recommendationController.getWishlistRecommendations);
router.get('/from-cart', validateRecommendationQuery, recommendationController.getCartRecommendations);
router.get('/for-you', validateRecommendationQuery, recommendationController.getPersonalizedForYou);

module.exports = router;
