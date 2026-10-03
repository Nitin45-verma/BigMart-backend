const Cart = require('../models/Cart');
const Product = require('../models/Product');
const ApiError = require('../utils/ApiError');
const { roundMoney } = require('../utils/moneyUtils');

/**
 * Gets the authenticated user's cart with fresh product details and server-calculated totals.
 */
const getCart = async (userId) => {
  let cart = await Cart.findOne({ user: userId });
  if (!cart) {
    cart = await Cart.create({ user: userId, items: [] });
  }

  // Populate product details (costPrice is select: false by default)
  await cart.populate({
    path: 'items.product',
    select: 'name slug images price compareAtPrice gstRate stock status isPublished seller brand'
  });

  // Filter out products that no longer exist or are archived
  const validItems = [];
  let cartTotal = 0;
  let totalItemsCount = 0;

  for (const item of cart.items) {
    if (!item.product) continue;

    const prod = item.product;
    const isAvailable = prod.status === 'active' && prod.isPublished && prod.stock > 0;
    const availableStock = prod.stock || 0;
    const effectiveQty = Math.min(item.quantity, availableStock > 0 ? availableStock : item.quantity);
    const itemTotal = roundMoney(prod.price * effectiveQty);

    if (isAvailable) {
      cartTotal = roundMoney(cartTotal + itemTotal);
    }
    totalItemsCount += effectiveQty;

    validItems.push({
      product: {
        _id: prod._id,
        name: prod.name,
        slug: prod.slug,
        images: prod.images,
        price: prod.price,
        compareAtPrice: prod.compareAtPrice,
        gstRate: prod.gstRate,
        brand: prod.brand,
        status: prod.status,
        isPublished: prod.isPublished,
        availableStock: prod.stock
      },
      quantity: effectiveQty,
      itemTotal,
      isAvailable
    });
  }

  return {
    _id: cart._id,
    user: cart.user,
    items: validItems,
    cartTotal: roundMoney(cartTotal),
    itemCount: totalItemsCount,
    updatedAt: cart.updatedAt
  };
};

/**
 * Customer adds a product to cart.
 */
const addItemToCart = async (userId, productId, quantity = 1) => {
  const product = await Product.findById(productId);
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }

  if (product.status !== 'active' || !product.isPublished) {
    throw new ApiError(400, 'Product is not available for purchase');
  }

  if (product.stock <= 0) {
    throw new ApiError(409, 'Product is out of stock');
  }

  if (quantity > product.stock) {
    throw new ApiError(409, `Insufficient stock. Only ${product.stock} items available`);
  }

  let cart = await Cart.findOne({ user: userId });
  if (!cart) {
    cart = await Cart.create({ user: userId, items: [] });
  }

  const itemIndex = cart.items.findIndex((item) => item.product.toString() === productId.toString());

  if (itemIndex > -1) {
    const newQty = cart.items[itemIndex].quantity + quantity;
    if (newQty > product.stock) {
      throw new ApiError(409, `Cannot add more items. Total requested quantity (${newQty}) exceeds available stock (${product.stock})`);
    }
    cart.items[itemIndex].quantity = newQty;
  } else {
    cart.items.push({ product: productId, quantity });
  }

  await cart.save();
  return getCart(userId);
};

/**
 * Customer updates quantity of an existing item in cart.
 */
const updateCartItemQuantity = async (userId, productId, quantity) => {
  const product = await Product.findById(productId);
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }

  if (product.status !== 'active' || !product.isPublished) {
    throw new ApiError(400, 'Product is no longer available');
  }

  if (quantity > product.stock) {
    throw new ApiError(409, `Requested quantity (${quantity}) exceeds available stock (${product.stock})`);
  }

  const cart = await Cart.findOne({ user: userId });
  if (!cart) {
    throw new ApiError(404, 'Cart not found');
  }

  const itemIndex = cart.items.findIndex((item) => item.product.toString() === productId.toString());
  if (itemIndex === -1) {
    throw new ApiError(404, 'Item not found in cart');
  }

  cart.items[itemIndex].quantity = quantity;
  await cart.save();

  return getCart(userId);
};

/**
 * Customer removes an item from cart.
 */
const removeItemFromCart = async (userId, productId) => {
  const cart = await Cart.findOne({ user: userId });
  if (!cart) {
    throw new ApiError(404, 'Cart not found');
  }

  cart.items = cart.items.filter((item) => item.product.toString() !== productId.toString());
  await cart.save();

  return getCart(userId);
};

/**
 * Customer clears entire cart.
 */
const clearCart = async (userId) => {
  let cart = await Cart.findOne({ user: userId });
  if (!cart) {
    cart = await Cart.create({ user: userId, items: [] });
  } else {
    cart.items = [];
    await cart.save();
  }

  return getCart(userId);
};

module.exports = {
  getCart,
  addItemToCart,
  updateCartItemQuantity,
  removeItemFromCart,
  clearCart
};
