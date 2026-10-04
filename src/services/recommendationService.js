const mongoose = require('mongoose');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Wishlist = require('../models/Wishlist');
const RecentlyViewed = require('../models/RecentlyViewed');
const ApiError = require('../utils/ApiError');

// Base query for public product visibility
const publicProductQuery = {
  status: 'active',
  isPublished: true
};

// Helper: Pagination wrapper
const paginateList = (items, page, limit) => {
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);
  const skip = (pageNum - 1) * limitNum;
  
  const paginated = items.slice(skip, skip + limitNum);
  const total = items.length;
  const totalPages = Math.ceil(total / limitNum);

  return {
    products: paginated,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages,
      hasNextPage: pageNum < totalPages,
      hasPreviousPage: pageNum > 1
    }
  };
};

const getNewArrivals = async (page = 1, limit = 10) => {
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);
  const skip = (pageNum - 1) * limitNum;

  const products = await Product.find(publicProductQuery)
    .select('-costPrice')
    .populate('category', 'name slug')
    .populate('seller', 'businessName businessType')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum);

  const total = await Product.countDocuments(publicProductQuery);
  const totalPages = Math.ceil(total / limitNum);

  return {
    products,
    pagination: { page: pageNum, limit: limitNum, total, totalPages, hasNextPage: pageNum < totalPages, hasPreviousPage: pageNum > 1 }
  };
};

const getTrending = async (page = 1, limit = 10) => {
  // Trending based on order frequency over the last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const pipeline = [
    {
      $match: {
        createdAt: { $gte: thirtyDaysAgo },
        'payment.status': 'paid',
        orderStatus: { $ne: 'cancelled' }
      }
    },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.product',
        purchaseCount: { $sum: '$items.quantity' }
      }
    },
    { $sort: { purchaseCount: -1 } },
    { $limit: 100 } // Get top 100 trending candidates
  ];

  const trendingItems = await Order.aggregate(pipeline);
  const trendingProductIds = trendingItems.map(item => item._id);

  // Fetch product details for the trending IDs, enforcing public visibility
  const products = await Product.find({
    _id: { $in: trendingProductIds },
    ...publicProductQuery,
    stock: { $gt: 0 }
  })
    .select('-costPrice')
    .populate('category', 'name slug')
    .populate('seller', 'businessName businessType');

  // Sort them back according to the trending frequency
  const sortedProducts = [];
  trendingProductIds.forEach(id => {
    const p = products.find(prod => prod._id.toString() === id.toString());
    if (p) sortedProducts.push(p);
  });

  return paginateList(sortedProducts, page, limit);
};

const getTopRated = async (page = 1, limit = 10) => {
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);
  const skip = (pageNum - 1) * limitNum;

  const query = {
    ...publicProductQuery,
    ratingCount: { $gt: 0 } // Exclude products with no ratings
  };

  const products = await Product.find(query)
    .select('-costPrice')
    .populate('category', 'name slug')
    .populate('seller', 'businessName businessType')
    .sort({ ratingAverage: -1, ratingCount: -1, createdAt: -1 })
    .skip(skip)
    .limit(limitNum);

  const total = await Product.countDocuments(query);
  const totalPages = Math.ceil(total / limitNum);

  return {
    products,
    pagination: { page: pageNum, limit: limitNum, total, totalPages, hasNextPage: pageNum < totalPages, hasPreviousPage: pageNum > 1 }
  };
};

const getBestDeals = async (page = 1, limit = 10) => {
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);
  const skip = (pageNum - 1) * limitNum;

  const pipeline = [
    {
      $match: {
        ...publicProductQuery,
        stock: { $gt: 0 },
        $expr: { $gt: ['$compareAtPrice', '$price'] }
      }
    },
    {
      $addFields: {
        discountPercentage: {
          $multiply: [
            { $divide: [{ $subtract: ['$compareAtPrice', '$price'] }, '$compareAtPrice'] },
            100
          ]
        }
      }
    },
    { $sort: { discountPercentage: -1, createdAt: -1 } },
    {
      $facet: {
        metadata: [{ $count: "total" }],
        data: [{ $skip: skip }, { $limit: limitNum }]
      }
    }
  ];

  const result = await Product.aggregate(pipeline);
  const products = result[0].data;
  const total = result[0].metadata[0] ? result[0].metadata[0].total : 0;
  
  await Product.populate(products, [
    { path: 'category', select: 'name slug' },
    { path: 'seller', select: 'businessName businessType' }
  ]);
  
  products.forEach(p => {
    delete p.costPrice;
    delete p.discountPercentage;
  });

  const totalPages = Math.ceil(total / limitNum);

  return {
    products,
    pagination: { page: pageNum, limit: limitNum, total, totalPages, hasNextPage: pageNum < totalPages, hasPreviousPage: pageNum > 1 }
  };
};

const getRelatedProducts = async (productId, page = 1, limit = 10) => {
  const sourceProduct = await Product.findById(productId);
  if (!sourceProduct) {
    throw new ApiError(404, 'Product not found');
  }

  // Related means same subcategory, category, or brand. Exclude source product.
  // We'll use a score-based aggregation.
  const pipeline = [
    {
      $match: {
        _id: { $ne: sourceProduct._id },
        ...publicProductQuery,
        $or: [
          { category: sourceProduct.category },
          { subCategory: sourceProduct.subCategory },
          { brand: sourceProduct.brand }
        ]
      }
    },
    {
      $addFields: {
        score: {
          $sum: [
            { $cond: [{ $and: [ { $eq: ['$subCategory', sourceProduct.subCategory] }, { $ne: ['$subCategory', null] } ] }, 3, 0] },
            { $cond: [{ $eq: ['$category', sourceProduct.category] }, 2, 0] },
            { $cond: [{ $and: [ { $eq: ['$brand', sourceProduct.brand] }, { $ne: ['$brand', null] } ] }, 1, 0] }
          ]
        }
      }
    },
    { $sort: { score: -1, ratingAverage: -1, createdAt: -1 } },
    { $limit: 100 }
  ];

  const result = await Product.aggregate(pipeline);
  await Product.populate(result, [
    { path: 'category', select: 'name slug' },
    { path: 'seller', select: 'businessName businessType' }
  ]);
  
  result.forEach(p => {
    delete p.costPrice;
    delete p.score;
  });

  return paginateList(result, page, limit);
};

const getCategoryRecommendations = async (categorySlug, page = 1, limit = 10) => {
  const category = await Category.findOne({ slug: categorySlug.toLowerCase().trim(), isActive: true });
  if (!category) {
    return paginateList([], page, limit);
  }

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);
  const skip = (pageNum - 1) * limitNum;

  const query = {
    ...publicProductQuery,
    $or: [{ category: category._id }, { subCategory: category._id }]
  };

  const products = await Product.find(query)
    .select('-costPrice')
    .populate('category', 'name slug')
    .populate('seller', 'businessName businessType')
    .sort({ ratingAverage: -1, createdAt: -1 })
    .skip(skip)
    .limit(limitNum);

  const total = await Product.countDocuments(query);
  const totalPages = Math.ceil(total / limitNum);

  return {
    products,
    pagination: { page: pageNum, limit: limitNum, total, totalPages, hasNextPage: pageNum < totalPages, hasPreviousPage: pageNum > 1 }
  };
};

const getSellerRecommendations = async (sellerId, page = 1, limit = 10) => {
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);
  const skip = (pageNum - 1) * limitNum;

  const query = {
    ...publicProductQuery,
    seller: sellerId
  };

  const products = await Product.find(query)
    .select('-costPrice')
    .populate('category', 'name slug')
    .populate('seller', 'businessName businessType')
    .sort({ ratingAverage: -1, createdAt: -1 })
    .skip(skip)
    .limit(limitNum);

  const total = await Product.countDocuments(query);
  const totalPages = Math.ceil(total / limitNum);

  return {
    products,
    pagination: { page: pageNum, limit: limitNum, total, totalPages, hasNextPage: pageNum < totalPages, hasPreviousPage: pageNum > 1 }
  };
};

const recordProductView = async (userId, productId) => {
  // Only record public product views
  const product = await Product.findOne({ _id: productId, ...publicProductQuery });
  if (!product) {
    throw new ApiError(404, 'Product not found or unavailable');
  }

  let recentlyViewed = await RecentlyViewed.findOne({ user: userId });
  if (!recentlyViewed) {
    recentlyViewed = new RecentlyViewed({ user: userId, items: [] });
  }

  // Remove if exists to update timestamp (move to front conceptually, newest last in array, or newest first)
  // Let's store newest first
  recentlyViewed.items = recentlyViewed.items.filter(item => item.product.toString() !== productId.toString());
  
  recentlyViewed.items.unshift({ product: productId, viewedAt: new Date() });

  // Cap at 50
  if (recentlyViewed.items.length > 50) {
    recentlyViewed.items = recentlyViewed.items.slice(0, 50);
  }

  await recentlyViewed.save();
  return { message: 'Product view recorded' };
};

const getRecentlyViewed = async (userId, page = 1, limit = 10) => {
  const recentlyViewed = await RecentlyViewed.findOne({ user: userId });
  if (!recentlyViewed || recentlyViewed.items.length === 0) {
    return paginateList([], page, limit);
  }

  const productIds = recentlyViewed.items.map(i => i.product);

  const products = await Product.find({
    _id: { $in: productIds },
    ...publicProductQuery
  })
    .select('-costPrice')
    .populate('category', 'name slug')
    .populate('seller', 'businessName businessType');

  // Sort according to viewedAt order (recentlyViewed array order)
  const sortedProducts = [];
  recentlyViewed.items.forEach(item => {
    const p = products.find(prod => prod._id.toString() === item.product.toString());
    if (p) sortedProducts.push(p);
  });

  return paginateList(sortedProducts, page, limit);
};

const getWishlistRecommendations = async (userId, page = 1, limit = 10) => {
  const wishlist = await Wishlist.findOne({ user: userId }).populate('items.product');
  if (!wishlist || wishlist.items.length === 0) {
    return paginateList([], page, limit);
  }

  const wishlistProductIds = [];
  const categories = new Set();
  const brands = new Set();

  wishlist.items.forEach(item => {
    if (item.product && item.product.status === 'active' && item.product.isPublished === true) {
      wishlistProductIds.push(item.product._id);
      if (item.product.category) categories.add(item.product.category.toString());
      if (item.product.subCategory) categories.add(item.product.subCategory.toString());
      if (item.product.brand) brands.add(item.product.brand);
    }
  });

  if (categories.size === 0 && brands.size === 0) {
    return paginateList([], page, limit);
  }

  const query = {
    _id: { $nin: wishlistProductIds },
    ...publicProductQuery,
    stock: { $gt: 0 },
    $or: [
      { category: { $in: Array.from(categories) } },
      { subCategory: { $in: Array.from(categories) } },
      { brand: { $in: Array.from(brands) } }
    ]
  };

  const products = await Product.find(query)
    .select('-costPrice')
    .populate('category', 'name slug')
    .populate('seller', 'businessName businessType')
    .sort({ ratingAverage: -1, createdAt: -1 })
    .limit(100);

  return paginateList(products, page, limit);
};

const getCartRecommendations = async (userId, page = 1, limit = 10) => {
  const cart = await Cart.findOne({ user: userId }).populate('items.product');
  if (!cart || cart.items.length === 0) {
    return paginateList([], page, limit);
  }

  const cartProductIds = [];
  const categories = new Set();
  const brands = new Set();

  cart.items.forEach(item => {
    if (item.product && item.product.status === 'active' && item.product.isPublished === true) {
      cartProductIds.push(item.product._id);
      if (item.product.category) categories.add(item.product.category.toString());
      if (item.product.subCategory) categories.add(item.product.subCategory.toString());
      if (item.product.brand) brands.add(item.product.brand);
    }
  });

  if (categories.size === 0 && brands.size === 0) {
    return paginateList([], page, limit);
  }

  const query = {
    _id: { $nin: cartProductIds },
    ...publicProductQuery,
    stock: { $gt: 0 },
    $or: [
      { category: { $in: Array.from(categories) } },
      { subCategory: { $in: Array.from(categories) } },
      { brand: { $in: Array.from(brands) } }
    ]
  };

  const products = await Product.find(query)
    .select('-costPrice')
    .populate('category', 'name slug')
    .populate('seller', 'businessName businessType')
    .sort({ ratingAverage: -1, createdAt: -1 })
    .limit(100);

  return paginateList(products, page, limit);
};

const getAlsoBought = async (productId, page = 1, limit = 10) => {
  const sourceProduct = await Product.findById(productId);
  if (!sourceProduct) {
    throw new ApiError(404, 'Product not found');
  }

  // Find orders (paid/not cancelled) containing the source product
  // Then group the OTHER products in those orders
  const pipeline = [
    {
      $match: {
        'items.product': sourceProduct._id,
        'payment.status': 'paid',
        orderStatus: { $ne: 'cancelled' }
      }
    },
    { $unwind: '$items' },
    {
      $match: {
        'items.product': { $ne: sourceProduct._id } // exclude the source product itself
      }
    },
    {
      $group: {
        _id: '$items.product',
        purchaseCount: { $sum: '$items.quantity' }
      }
    },
    { $sort: { purchaseCount: -1 } },
    { $limit: 100 }
  ];

  const alsoBoughtItems = await Order.aggregate(pipeline);
  
  if (alsoBoughtItems.length === 0) {
    // Safe fallback to related products if no purchase history
    return getRelatedProducts(productId, page, limit);
  }

  const productIds = alsoBoughtItems.map(item => item._id);

  const products = await Product.find({
    _id: { $in: productIds },
    ...publicProductQuery,
    stock: { $gt: 0 }
  })
    .select('-costPrice')
    .populate('category', 'name slug')
    .populate('seller', 'businessName businessType');

  // Sort them back according to purchaseCount frequency
  const sortedProducts = [];
  productIds.forEach(id => {
    const p = products.find(prod => prod._id.toString() === id.toString());
    if (p) sortedProducts.push(p);
  });

  return paginateList(sortedProducts, page, limit);
};

const getPersonalizedForYou = async (userId, page = 1, limit = 10) => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  // 1. Collect signals
  const categories = new Set();
  const brands = new Set();
  const excludeProductIds = new Set();

  // A. Wishlist signals
  const wishlist = await Wishlist.findOne({ user: userId }).populate('items.product');
  if (wishlist) {
    wishlist.items.forEach(item => {
      if (item.product) {
        excludeProductIds.add(item.product._id.toString());
        if (item.product.category) categories.add(item.product.category.toString());
        if (item.product.brand) brands.add(item.product.brand);
      }
    });
  }

  // B. Cart signals
  const cart = await Cart.findOne({ user: userId }).populate('items.product');
  if (cart) {
    cart.items.forEach(item => {
      if (item.product) {
        excludeProductIds.add(item.product._id.toString());
        if (item.product.category) categories.add(item.product.category.toString());
        if (item.product.brand) brands.add(item.product.brand);
      }
    });
  }

  // C. Recently Viewed signals
  const recentlyViewed = await RecentlyViewed.findOne({ user: userId }).populate('items.product');
  if (recentlyViewed) {
    // Only take top 20 recent views to avoid noise
    recentlyViewed.items.slice(0, 20).forEach(item => {
      if (item.product) {
        if (item.product.category) categories.add(item.product.category.toString());
        if (item.product.brand) brands.add(item.product.brand);
      }
    });
  }

  // D. Past Orders signals
  const pastOrders = await Order.find({
    user: userId,
    createdAt: { $gte: thirtyDaysAgo },
    orderStatus: { $ne: 'cancelled' }
  }).populate('items.product');
  
  pastOrders.forEach(order => {
    order.items.forEach(item => {
      if (item.product) {
        excludeProductIds.add(item.product._id.toString()); // don't recommend what they just bought
        if (item.product.category) categories.add(item.product.category.toString());
        if (item.product.brand) brands.add(item.product.brand);
      }
    });
  });

  // If no signals, fallback to trending
  if (categories.size === 0 && brands.size === 0) {
    return getTrending(page, limit);
  }

  const pipeline = [
    {
      $match: {
        _id: { $nin: Array.from(excludeProductIds).map(id => new mongoose.Types.ObjectId(id)) },
        ...publicProductQuery,
        stock: { $gt: 0 },
        $or: [
          { category: { $in: Array.from(categories).map(id => new mongoose.Types.ObjectId(id)) } },
          { subCategory: { $in: Array.from(categories).map(id => new mongoose.Types.ObjectId(id)) } },
          { brand: { $in: Array.from(brands) } }
        ]
      }
    },
    {
      $addFields: {
        score: {
          $sum: [
            { $cond: [{ $in: ['$category', Array.from(categories).map(id => new mongoose.Types.ObjectId(id))] }, 2, 0] },
            { $cond: [{ $in: ['$brand', Array.from(brands)] }, 1, 0] }
          ]
        }
      }
    },
    { $sort: { score: -1, ratingAverage: -1, createdAt: -1 } },
    { $limit: 100 }
  ];

  const result = await Product.aggregate(pipeline);
  await Product.populate(result, [
    { path: 'category', select: 'name slug' },
    { path: 'seller', select: 'businessName businessType' }
  ]);
  
  result.forEach(p => {
    delete p.costPrice;
    delete p.score;
  });

  return paginateList(result, page, limit);
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
