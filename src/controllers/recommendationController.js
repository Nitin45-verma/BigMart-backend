const recommendationService = require('../services/recommendationService');

const getNewArrivals = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await recommendationService.getNewArrivals(page, limit);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const getTrending = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await recommendationService.getTrending(page, limit);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const getTopRated = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await recommendationService.getTopRated(page, limit);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const getBestDeals = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await recommendationService.getBestDeals(page, limit);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const getRelatedProducts = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await recommendationService.getRelatedProducts(req.params.productId, page, limit);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const getCategoryRecommendations = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await recommendationService.getCategoryRecommendations(req.params.categorySlug, page, limit);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const getSellerRecommendations = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await recommendationService.getSellerRecommendations(req.params.sellerId, page, limit);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const recordProductView = async (req, res, next) => {
  try {
    const result = await recommendationService.recordProductView(req.user.userId, req.params.productId);
    res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    next(error);
  }
};

const getRecentlyViewed = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await recommendationService.getRecentlyViewed(req.user.userId, page, limit);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const getWishlistRecommendations = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await recommendationService.getWishlistRecommendations(req.user.userId, page, limit);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const getCartRecommendations = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await recommendationService.getCartRecommendations(req.user.userId, page, limit);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const getAlsoBought = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await recommendationService.getAlsoBought(req.params.productId, page, limit);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const getPersonalizedForYou = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await recommendationService.getPersonalizedForYou(req.user.userId, page, limit);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNewArrivals,
  getTrending,
  getTopRated,
  getBestDeals,
  getRelatedProducts,
  getCategoryRecommendations,
  getSellerRecommendations,
  recordProductView,
  getRecentlyViewed,
  getWishlistRecommendations,
  getCartRecommendations,
  getAlsoBought,
  getPersonalizedForYou
};
