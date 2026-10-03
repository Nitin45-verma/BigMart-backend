const mongoose = require('mongoose');
const ProductReview = require('../models/ProductReview');
const ReviewReport = require('../models/ReviewReport');
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const Seller = require('../models/Seller');
const AdminAuditLog = require('../models/AdminAuditLog');
const { createNotification } = require('./notificationService');
const ApiError = require('../utils/ApiError');
const {
  validateCreateReview,
  validateUpdateReview,
  validateSellerReply,
  validateAdminStatus,
  validateReportReview,
  isValidObjectId
} = require('../validators/reviewValidator');

/**
 * Recalculates and updates product rating summary (ratingAverage, ratingCount, ratingBreakdown).
 * Must be executed whenever a review is created, edited, hidden, rejected, restored, or deleted.
 */
const recalculateProductRating = async (productId) => {
  if (!productId) return;

  const reviews = await ProductReview.find({ product: productId, status: 'published' });

  const ratingCount = reviews.length;
  const ratingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  if (ratingCount === 0) {
    await Product.findByIdAndUpdate(productId, {
      ratingAverage: 0,
      ratingCount: 0,
      ratingBreakdown
    });
    return;
  }

  let totalStars = 0;
  for (const r of reviews) {
    totalStars += r.rating;
    if (ratingBreakdown[r.rating] !== undefined) {
      ratingBreakdown[r.rating] += 1;
    }
  }

  const ratingAverage = Math.round((totalStars / ratingCount) * 10) / 10;

  await Product.findByIdAndUpdate(productId, {
    ratingAverage,
    ratingCount,
    ratingBreakdown
  });
};

/**
 * Customer: Create a product review.
 * Verifies purchase ownership, product inclusion, and order status server-side.
 */
const createReview = async (userId, productId, reviewData) => {
  if (!isValidObjectId(productId)) {
    throw new ApiError(400, 'Invalid productId format');
  }

  validateCreateReview(reviewData);

  const product = await Product.findById(productId);
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }

  const user = await User.findById(userId);
  if (!user || user.isBlocked) {
    throw new ApiError(403, 'User account is inactive or blocked');
  }

  if (user.role !== 'customer') {
    throw new ApiError(403, 'Only customer accounts can submit product reviews');
  }

  // Server-side purchase verification
  const orderQuery = {
    user: userId,
    'items.product': productId,
    orderStatus: { $in: ['paid', 'processing', 'shipped', 'out_of_delivery', 'delivered'] }
  };

  if (reviewData.orderId) {
    if (!isValidObjectId(reviewData.orderId)) {
      throw new ApiError(400, 'Invalid orderId format');
    }
    orderQuery._id = reviewData.orderId;
  }

  const eligibleOrder = await Order.findOne(orderQuery).sort({ createdAt: -1 });

  if (!eligibleOrder) {
    throw new ApiError(
      403,
      'You can only review products from eligible completed orders you have purchased'
    );
  }

  // Identify specific order item
  const orderItem = eligibleOrder.items.find(
    (item) => item.product.toString() === productId.toString()
  );

  const orderItemId = productId.toString();

  // Duplicate check: customer + order + orderItemId + product
  const existingReview = await ProductReview.findOne({
    customer: userId,
    order: eligibleOrder._id,
    orderItemId,
    product: productId
  });

  if (existingReview) {
    throw new ApiError(409, 'You have already reviewed this product for this order item');
  }

  // Derive seller from product/order item
  const sellerId = orderItem ? orderItem.seller : product.seller;

  const review = await ProductReview.create({
    product: productId,
    customer: userId,
    seller: sellerId,
    order: eligibleOrder._id,
    orderItemId,
    rating: reviewData.rating,
    title: reviewData.title ? reviewData.title.trim() : undefined,
    comment: reviewData.comment.trim(),
    images: reviewData.images || [],
    isVerifiedPurchase: true,
    status: 'published'
  });

  // Recalculate product rating summary
  await recalculateProductRating(productId);

  // Notify seller of new review
  const seller = await Seller.findById(sellerId);
  if (seller && seller.user) {
    await createNotification({
      recipient: seller.user,
      recipientRole: 'seller',
      type: 'SELLER_REVIEW_RECEIVED',
      title: 'New Product Review Received',
      message: `A customer left a ${review.rating}-star review for '${product.name}'`,
      order: eligibleOrder._id,
      data: { reviewId: review._id, productId, rating: review.rating },
      eventKey: `SELLER_REVIEW_RECEIVED:${review._id}:${seller.user}`
    }).catch((err) => console.warn('[ReviewService] Seller notification failed:', err.message));
  }

  // Notify customer
  await createNotification({
    recipient: userId,
    recipientRole: 'customer',
    type: 'REVIEW_CREATED',
    title: 'Review Submitted',
    message: `Thank you! Your ${review.rating}-star review for '${product.name}' was published.`,
    order: eligibleOrder._id,
    data: { reviewId: review._id, productId },
    eventKey: `REVIEW_CREATED:${review._id}:${userId}`
  }).catch((err) => console.warn('[ReviewService] Customer notification failed:', err.message));

  return review;
};

/**
 * Public: List published product reviews with pagination, sorting, and rating filter.
 */
const getPublicProductReviews = async (productId, { page = 1, limit = 10, rating, sort = 'newest' }) => {
  if (!isValidObjectId(productId)) {
    throw new ApiError(400, 'Invalid productId format');
  }

  const query = { product: productId, status: 'published' };

  if (rating) {
    const ratingNum = parseInt(rating, 10);
    if (ratingNum >= 1 && ratingNum <= 5) {
      query.rating = ratingNum;
    }
  }

  let sortOption = { createdAt: -1 };
  if (sort === 'oldest') sortOption = { createdAt: 1 };
  else if (sort === 'rating_high') sortOption = { rating: -1, createdAt: -1 };
  else if (sort === 'rating_low') sortOption = { rating: 1, createdAt: -1 };

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);
  const skip = (pageNum - 1) * limitNum;

  const reviews = await ProductReview.find(query)
    .populate('customer', 'name firstName lastName avatar')
    .sort(sortOption)
    .skip(skip)
    .limit(limitNum);

  const total = await ProductReview.countDocuments(query);

  return {
    reviews,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum)
  };
};

/**
 * Public/Customer: Get single review by ID.
 */
const getReviewById = async (reviewId, requestingUserId = null) => {
  if (!isValidObjectId(reviewId)) {
    throw new ApiError(400, 'Invalid reviewId format');
  }

  const review = await ProductReview.findById(reviewId)
    .populate('customer', 'name firstName lastName avatar')
    .populate('product', 'name slug images brand price');

  if (!review) {
    throw new ApiError(404, 'Review not found');
  }

  // If review is not published, only the customer owner can view it
  const isOwner = requestingUserId && review.customer._id.toString() === requestingUserId.toString();
  if (review.status !== 'published' && !isOwner) {
    throw new ApiError(404, 'Review not found');
  }

  return review;
};

/**
 * Customer: Edit own review.
 */
const updateCustomerReview = async (userId, reviewId, updateData) => {
  if (!isValidObjectId(reviewId)) {
    throw new ApiError(400, 'Invalid reviewId format');
  }

  validateUpdateReview(updateData);

  const review = await ProductReview.findById(reviewId);
  if (!review) {
    throw new ApiError(404, 'Review not found');
  }

  if (review.customer.toString() !== userId.toString()) {
    throw new ApiError(403, 'You can only edit your own review');
  }

  if (updateData.rating !== undefined) review.rating = updateData.rating;
  if (updateData.title !== undefined) review.title = updateData.title.trim();
  if (updateData.comment !== undefined) review.comment = updateData.comment.trim();
  if (updateData.images !== undefined) review.images = updateData.images;

  await review.save();

  // Recalculate product rating summary
  await recalculateProductRating(review.product);

  return review;
};

/**
 * Customer: Delete / withdraw own review.
 */
const deleteCustomerReview = async (userId, reviewId) => {
  if (!isValidObjectId(reviewId)) {
    throw new ApiError(400, 'Invalid reviewId format');
  }

  const review = await ProductReview.findById(reviewId);
  if (!review) {
    throw new ApiError(404, 'Review not found');
  }

  if (review.customer.toString() !== userId.toString()) {
    throw new ApiError(403, 'You can only delete your own review');
  }

  const productId = review.product;
  await ProductReview.deleteOne({ _id: reviewId });

  // Recalculate product rating summary
  await recalculateProductRating(productId);

  return { message: 'Review successfully deleted' };
};

/**
 * Customer: Report inappropriate review for abuse moderation.
 */
const reportReview = async (userId, reviewId, reportData) => {
  if (!isValidObjectId(reviewId)) {
    throw new ApiError(400, 'Invalid reviewId format');
  }

  validateReportReview(reportData);

  const review = await ProductReview.findById(reviewId);
  if (!review || review.status !== 'published') {
    throw new ApiError(404, 'Review not found');
  }

  // Duplicate report check
  const existingReport = await ReviewReport.findOne({ review: reviewId, reporter: userId });
  if (existingReport) {
    throw new ApiError(409, 'You have already reported this review');
  }

  const report = await ReviewReport.create({
    review: reviewId,
    reporter: userId,
    reason: reportData.reason,
    description: reportData.description ? reportData.description.trim() : undefined
  });

  // Increment reported count on review
  await ProductReview.findByIdAndUpdate(reviewId, { $inc: { reportedCount: 1 } });

  // Notify admins
  const admins = await User.find({ role: 'admin' });
  for (const admin of admins) {
    await createNotification({
      recipient: admin._id,
      recipientRole: 'admin',
      type: 'REVIEW_REPORTED',
      title: 'Product Review Reported',
      message: `A review for product '${review.product}' was reported for reason '${report.reason}'`,
      data: { reviewId, reportId: report._id, reason: report.reason },
      eventKey: `REVIEW_REPORTED:${reviewId}:${admin._id}`
    }).catch((err) => console.warn('[ReviewService] Admin report notification failed:', err.message));
  }

  return { message: 'Review report submitted successfully', reportId: report._id };
};

/**
 * Seller: List reviews for products owned by seller.
 */
const getSellerReviews = async (sellerUserId, { page = 1, limit = 20, product, rating, status }) => {
  const seller = await Seller.findOne({ user: sellerUserId });
  if (!seller) {
    throw new ApiError(403, 'Seller profile not found');
  }

  const query = { seller: seller._id };

  if (product && isValidObjectId(product)) {
    query.product = product;
  }
  if (rating) {
    const rNum = parseInt(rating, 10);
    if (rNum >= 1 && rNum <= 5) query.rating = rNum;
  }
  if (status && ['published', 'pending', 'hidden', 'rejected'].includes(status)) {
    query.status = status;
  }

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
  const skip = (pageNum - 1) * limitNum;

  const reviews = await ProductReview.find(query)
    .populate('customer', 'name firstName avatar')
    .populate('product', 'name slug images brand price')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum);

  const total = await ProductReview.countDocuments(query);

  return {
    reviews,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum)
  };
};

/**
 * Seller: Get single review for seller's product.
 */
const getSellerReviewById = async (sellerUserId, reviewId) => {
  if (!isValidObjectId(reviewId)) {
    throw new ApiError(400, 'Invalid reviewId format');
  }

  const seller = await Seller.findOne({ user: sellerUserId });
  if (!seller) {
    throw new ApiError(403, 'Seller profile not found');
  }

  const review = await ProductReview.findOne({ _id: reviewId, seller: seller._id })
    .populate('customer', 'name firstName avatar')
    .populate('product', 'name slug images brand price');

  if (!review) {
    throw new ApiError(404, 'Review not found');
  }

  return review;
};

/**
 * Seller: Reply to a review for seller's product.
 */
const sellerReplyToReview = async (sellerUserId, reviewId, replyData) => {
  if (!isValidObjectId(reviewId)) {
    throw new ApiError(400, 'Invalid reviewId format');
  }

  validateSellerReply(replyData);

  const seller = await Seller.findOne({ user: sellerUserId });
  if (!seller) {
    throw new ApiError(403, 'Seller profile not found');
  }

  const review = await ProductReview.findOne({ _id: reviewId, seller: seller._id });
  if (!review) {
    throw new ApiError(404, 'Review not found');
  }

  const replyText = (replyData.reply || replyData.sellerReply).trim();

  review.sellerReply = replyText;
  review.sellerReplyAt = new Date();
  await review.save();

  // Notify customer of seller reply
  await createNotification({
    recipient: review.customer,
    recipientRole: 'customer',
    type: 'SELLER_REPLIED_TO_REVIEW',
    title: 'Seller Replied to Your Review',
    message: `The seller replied to your review: "${replyText.substring(0, 80)}..."`,
    data: { reviewId: review._id, sellerId: seller._id },
    eventKey: `SELLER_REPLIED_TO_REVIEW:${review._id}:${review.customer}`
  }).catch((err) => console.warn('[ReviewService] Seller reply notification failed:', err.message));

  return review;
};

/**
 * Admin: List all reviews with filters, pagination, and search.
 */
const getAdminReviews = async ({ page = 1, limit = 20, status, rating, product, seller, customer, search }) => {
  const query = {};

  if (status && ['published', 'pending', 'hidden', 'rejected'].includes(status)) {
    query.status = status;
  }
  if (rating) {
    const rNum = parseInt(rating, 10);
    if (rNum >= 1 && rNum <= 5) query.rating = rNum;
  }
  if (product && isValidObjectId(product)) query.product = product;
  if (seller && isValidObjectId(seller)) query.seller = seller;
  if (customer && isValidObjectId(customer)) query.customer = customer;

  if (search && search.trim()) {
    query.$or = [
      { title: new RegExp(search.trim(), 'i') },
      { comment: new RegExp(search.trim(), 'i') }
    ];
  }

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
  const skip = (pageNum - 1) * limitNum;

  const reviews = await ProductReview.find(query)
    .select('+adminNote')
    .populate('customer', 'name email role')
    .populate('seller', 'businessName user')
    .populate('product', 'name slug brand')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum);

  const total = await ProductReview.countDocuments(query);

  return {
    reviews,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum)
  };
};

/**
 * Admin: Get single review detail.
 */
const getAdminReviewById = async (reviewId) => {
  if (!isValidObjectId(reviewId)) {
    throw new ApiError(400, 'Invalid reviewId format');
  }

  const review = await ProductReview.findById(reviewId)
    .select('+adminNote')
    .populate('customer', 'name email role')
    .populate('seller', 'businessName user')
    .populate('product', 'name slug brand price');

  if (!review) {
    throw new ApiError(404, 'Review not found');
  }

  return review;
};

/**
 * Admin: Moderate review status (published, hidden, rejected).
 * Logs audit entry and updates product rating summary.
 */
const updateAdminReviewStatus = async (adminUserId, reviewId, { status, adminNote }) => {
  if (!isValidObjectId(reviewId)) {
    throw new ApiError(400, 'Invalid reviewId format');
  }

  validateAdminStatus({ status });

  const review = await ProductReview.findById(reviewId);
  if (!review) {
    throw new ApiError(404, 'Review not found');
  }

  const oldStatus = review.status;
  review.status = status;
  if (adminNote !== undefined) review.adminNote = adminNote ? adminNote.trim() : null;

  await review.save();

  // Recalculate product rating summary
  await recalculateProductRating(review.product);

  // Log admin audit entry
  await AdminAuditLog.create({
    admin: adminUserId,
    action: 'REVIEW_MODERATED',
    targetType: 'ProductReview',
    targetId: review._id,
    metadata: { oldStatus, newStatus: status, adminNote }
  });

  // Notify customer
  await createNotification({
    recipient: review.customer,
    recipientRole: 'customer',
    type: 'REVIEW_MODERATED',
    title: 'Review Status Updated',
    message: `Your review status was updated to '${status}'`,
    data: { reviewId: review._id, status },
    eventKey: `REVIEW_MODERATED:${review._id}:${status}`
  }).catch((err) => console.warn('[ReviewService] Moderation notification failed:', err.message));

  return review;
};

/**
 * Admin: Delete review.
 * Logs audit entry and updates product rating summary.
 */
const deleteAdminReview = async (adminUserId, reviewId) => {
  if (!isValidObjectId(reviewId)) {
    throw new ApiError(400, 'Invalid reviewId format');
  }

  const review = await ProductReview.findById(reviewId);
  if (!review) {
    throw new ApiError(404, 'Review not found');
  }

  const productId = review.product;
  await ProductReview.deleteOne({ _id: reviewId });

  // Recalculate product rating summary
  await recalculateProductRating(productId);

  // Log admin audit entry
  await AdminAuditLog.create({
    admin: adminUserId,
    action: 'REVIEW_DELETED',
    targetType: 'ProductReview',
    targetId: reviewId,
    metadata: { product: productId }
  });

  return { message: 'Review deleted by admin' };
};

module.exports = {
  recalculateProductRating,
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
