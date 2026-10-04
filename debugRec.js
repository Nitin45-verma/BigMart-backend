const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const Product = require('./src/models/Product');
const Category = require('./src/models/Category');
const Seller = require('./src/models/Seller');
const User = require('./src/models/User');
const Order = require('./src/models/Order');
const Cart = require('./src/models/Cart');
const Wishlist = require('./src/models/Wishlist');
const RecentlyViewed = require('./src/models/RecentlyViewed');
const { getTopRated, getBestDeals, getWishlistRecommendations } = require('./src/services/recommendationService');

mongoose.connect('mongodb://127.0.0.1:27017/bigmart_test_db').then(async () => {
  try {
    const r5 = await getTopRated();
    console.log('Top Rated Products:');
    r5.products.forEach(p => console.log(`${p.sku}: rating=${p.ratingAverage}, count=${p.ratingCount}`));
    
    const r7 = await getBestDeals();
    console.log('\nBest Deals Products:');
    r7.products.forEach(p => console.log(`${p.sku}: price=${p.price}, compareAt=${p.compareAtPrice}`));
    
    console.log('\nTest 44 data:');
    const cust2 = await User.findOne({ email: 'test_rec_cust2@test.com' });
    if(cust2) {
      const rw2 = await getWishlistRecommendations(cust2._id);
      console.log('Wishlist recs for cust2:', rw2.products.map(p => p.sku));
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
});
