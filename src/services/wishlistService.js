const Wishlist = require('../models/Wishlist');
const Product = require('../models/Product');
const ApiError = require('../utils/ApiError');
const cartService = require('./cartService');

/**
 * Get or create a wishlist for a user.
 */
const getWishlist = async (userId, page = 1, limit = 20) => {
  let wishlist = await Wishlist.findOne({ user: userId });
  if (!wishlist) {
    wishlist = await Wishlist.create({ user: userId, items: [] });
  }

  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  
  const totalItems = wishlist.items.length;
  
  // We populate just the ones for this page to save memory, or all.
  // Mongoose populate on array slices can be tricky, so we slice the items first,
  // create a dummy document and populate it. But wait, `wishlist.items` is a Mongoose Array.
  // It's easier to just populate the whole `items.product` array or slice first.
  
  const paginatedItems = wishlist.items.slice(startIndex, endIndex);

  // We can populate an array of plain objects using mongoose Model.populate
  await Wishlist.populate(paginatedItems, {
    path: 'product',
    select: 'name slug images price compareAtPrice stock status isPublished seller brand'
  });

  const formattedItems = paginatedItems.map(item => {
    const prod = item.product;
    if (!prod) {
      return {
        product: null,
        availability: 'unavailable',
        addedAt: item.addedAt
      };
    }

    const isAvailable = prod.status === 'active' && prod.isPublished && prod.stock > 0;
    let availability = 'available';
    if (prod.status === 'archived' || prod.status === 'deleted') {
      availability = 'unavailable';
    } else if (!prod.isPublished) {
      availability = 'unavailable';
    } else if (prod.stock <= 0) {
      availability = 'out_of_stock';
    } else if (prod.status !== 'active') {
      availability = 'unavailable';
    }

    return {
      product: {
        _id: prod._id,
        name: prod.name,
        slug: prod.slug,
        images: prod.images,
        price: prod.price,
        compareAtPrice: prod.compareAtPrice,
        brand: prod.brand,
        status: prod.status,
        isPublished: prod.isPublished,
        availableStock: prod.stock
      },
      availability,
      addedAt: item.addedAt
    };
  });

  return {
    items: formattedItems,
    pagination: {
      page,
      limit,
      total: totalItems,
      totalPages: Math.ceil(totalItems / limit) || 1
    }
  };
};

const addItemToWishlist = async (userId, productId) => {
  const product = await Product.findById(productId);
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }

  if (product.status !== 'active' || !product.isPublished) {
    throw new ApiError(400, 'Product is not available for wishlist');
  }

  let wishlist = await Wishlist.findOne({ user: userId });
  if (!wishlist) {
    wishlist = await Wishlist.create({ user: userId, items: [{ product: productId }] });
    return getWishlist(userId, 1, 20);
  }

  const exists = wishlist.items.some(item => item.product.toString() === productId.toString());
  if (exists) {
    throw new ApiError(409, 'Product is already in wishlist');
  }

  const updatedWishlist = await Wishlist.findOneAndUpdate(
    { user: userId, 'items.product': { $ne: productId } },
    { $push: { items: { product: productId, addedAt: new Date() } } },
    { new: true }
  );

  if (!updatedWishlist) {
    throw new ApiError(409, 'Product is already in wishlist');
  }

  return getWishlist(userId, 1, 20);
};

const removeItemFromWishlist = async (userId, productId) => {
  const wishlist = await Wishlist.findOneAndUpdate(
    { user: userId },
    { $pull: { items: { product: productId } } },
    { new: true }
  );

  if (!wishlist) {
    throw new ApiError(404, 'Wishlist not found');
  }

  return getWishlist(userId, 1, 20);
};

const getWishlistCount = async (userId) => {
  const wishlist = await Wishlist.findOne({ user: userId });
  return {
    count: wishlist ? wishlist.items.length : 0
  };
};

const checkProductWishlistStatus = async (userId, productId) => {
  const wishlist = await Wishlist.findOne({ user: userId, 'items.product': productId });
  return {
    productId,
    isWishlisted: !!wishlist
  };
};

const clearWishlist = async (userId) => {
  const wishlist = await Wishlist.findOneAndUpdate(
    { user: userId },
    { $set: { items: [] } },
    { new: true }
  );

  return { success: true, count: 0 };
};

const moveItemToCart = async (userId, productId) => {
  const wishlist = await Wishlist.findOne({ user: userId, 'items.product': productId });
  if (!wishlist) {
    throw new ApiError(404, 'Product not found in wishlist');
  }

  await cartService.addItemToCart(userId, productId, 1);

  await Wishlist.updateOne(
    { user: userId },
    { $pull: { items: { product: productId } } }
  );

  const updatedWishlist = await getWishlist(userId, 1, 20);
  const updatedCart = await cartService.getCart(userId);

  return {
    wishlist: updatedWishlist,
    cart: updatedCart
  };
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
