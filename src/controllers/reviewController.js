const reviewService = require('../services/reviewService');

/**
 * Customer: Submit a review for a product
 */
const createReview = async (req, res, next) => {
  try {
    const review = await reviewService.createReview(req.user.userId, req.params.productId, req.body);
    res.status(201).json({
      success: true,
      message: 'Review created successfully',
      data: { review }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Public: List published reviews for a product
 */
const getPublicProductReviews = async (req, res, next) => {
  try {
    const result = await reviewService.getPublicProductReviews(req.params.productId, req.query);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Public/Customer: Get review details by ID
 */
const getReviewById = async (req, res, next) => {
  try {
    const requestingUserId = req.user ? req.user.userId : null;
    const review = await reviewService.getReviewById(req.params.reviewId, requestingUserId);
    res.status(200).json({
      success: true,
      data: { review }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Customer: Update own review
 */
const updateCustomerReview = async (req, res, next) => {
  try {
    const review = await reviewService.updateCustomerReview(req.user.userId, req.params.reviewId, req.body);
    res.status(200).json({
      success: true,
      message: 'Review updated successfully',
      data: { review }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Customer: Delete own review
 */
const deleteCustomerReview = async (req, res, next) => {
  try {
    const result = await reviewService.deleteCustomerReview(req.user.userId, req.params.reviewId);
    res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Customer: Report an abusive or fake review
 */
const reportReview = async (req, res, next) => {
  try {
    const result = await reviewService.reportReview(req.user.userId, req.params.reviewId, req.body);
    res.status(201).json({
      success: true,
      message: result.message,
      data: { reportId: result.reportId }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Seller: List reviews for seller's products
 */
const getSellerReviews = async (req, res, next) => {
  try {
    const result = await reviewService.getSellerReviews(req.user.userId, req.query);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Seller: Get review detail for seller's product
 */
const getSellerReviewById = async (req, res, next) => {
  try {
    const review = await reviewService.getSellerReviewById(req.user.userId, req.params.reviewId);
    res.status(200).json({
      success: true,
      data: { review }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Seller: Reply to a product review
 */
const sellerReplyToReview = async (req, res, next) => {
  try {
    const review = await reviewService.sellerReplyToReview(req.user.userId, req.params.reviewId, req.body);
    res.status(200).json({
      success: true,
      message: 'Reply submitted successfully',
      data: { review }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: List all platform reviews
 */
const getAdminReviews = async (req, res, next) => {
  try {
    const result = await reviewService.getAdminReviews(req.query);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Get review detail by ID
 */
const getAdminReviewById = async (req, res, next) => {
  try {
    const review = await reviewService.getAdminReviewById(req.params.reviewId);
    res.status(200).json({
      success: true,
      data: { review }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Moderate review status (publish, hide, reject)
 */
const updateAdminReviewStatus = async (req, res, next) => {
  try {
    const review = await reviewService.updateAdminReviewStatus(req.user.userId, req.params.reviewId, req.body);
    res.status(200).json({
      success: true,
      message: 'Review status updated successfully',
      data: { review }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Delete review
 */
const deleteAdminReview = async (req, res, next) => {
  try {
    const result = await reviewService.deleteAdminReview(req.user.userId, req.params.reviewId);
    res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createReview,
  getPublicProductReviews,
  getReviewById,
  updateCustomerReview,
  deleteCustomerReview,
  reportReview,
  getSellerReviews,
  getSellerReviewById,
  sellerReplyToReview,
  getAdminReviews,
  getAdminReviewById,
  updateAdminReviewStatus,
  deleteAdminReview
};
