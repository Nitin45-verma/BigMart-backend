const cartService = require('../services/cartService');

/**
 * Customer: Get current cart
 */
const getCart = async (req, res, next) => {
  try {
    const cart = await cartService.getCart(req.user.userId);
    res.status(200).json({
      success: true,
      data: { cart }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Customer: Add item to cart
 */
const addItem = async (req, res, next) => {
  try {
    const { productId, quantity } = req.body;
    const cart = await cartService.addItemToCart(req.user.userId, productId, quantity || 1);
    res.status(200).json({
      success: true,
      message: 'Item added to cart successfully',
      data: { cart }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Customer: Update item quantity in cart
 */
const updateItemQuantity = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;
    const cart = await cartService.updateCartItemQuantity(req.user.userId, productId, quantity);
    res.status(200).json({
      success: true,
      message: 'Cart item quantity updated successfully',
      data: { cart }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Customer: Remove item from cart
 */
const removeItem = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const cart = await cartService.removeItemFromCart(req.user.userId, productId);
    res.status(200).json({
      success: true,
      message: 'Item removed from cart successfully',
      data: { cart }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Customer: Clear entire cart
 */
const clearCart = async (req, res, next) => {
  try {
    const cart = await cartService.clearCart(req.user.userId);
    res.status(200).json({
      success: true,
      message: 'Cart cleared successfully',
      data: { cart }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCart,
  addItem,
  updateItemQuantity,
  removeItem,
  clearCart
};
