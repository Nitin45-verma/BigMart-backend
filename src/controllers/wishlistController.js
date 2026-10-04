const wishlistService = require('../services/wishlistService');

const getWishlist = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;

    const data = await wishlistService.getWishlist(req.user.userId, page, limit);
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

const addItemToWishlist = async (req, res, next) => {
  try {
    const { productId } = req.body;
    const data = await wishlistService.addItemToWishlist(req.user.userId, productId);
    
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

const removeItemFromWishlist = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const data = await wishlistService.removeItemFromWishlist(req.user.userId, productId);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

const getWishlistCount = async (req, res, next) => {
  try {
    const data = await wishlistService.getWishlistCount(req.user.userId);
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

const checkProductWishlistStatus = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const data = await wishlistService.checkProductWishlistStatus(req.user.userId, productId);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

const clearWishlist = async (req, res, next) => {
  try {
    const data = await wishlistService.clearWishlist(req.user.userId);
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

const moveItemToCart = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const data = await wishlistService.moveItemToCart(req.user.userId, productId);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getWishlist,
  addItemToWishlist,
  removeItemFromWishlist,
  getWishlistCount,
  checkProductWishlistStatus,
  clearWishlist,
  moveItemToCart
};
