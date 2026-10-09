require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('../models/Category');
const Product = require('../models/Product');
const User = require('../models/User');
const Seller = require('../models/Seller');
const Coupon = require('../models/Coupon');
const ProductReview = require('../models/ProductReview');
const Order = require('../models/Order');

// 1. Safety Checks
if (process.env.NODE_ENV === 'production') {
  console.error('ERROR: Refusing to run demo seed script in production environment.');
  process.exit(1);
}

if (!process.argv.includes('--run-demo-seed')) {
  console.error('ERROR: Explicit opt-in flag --run-demo-seed is required.');
  console.error('Run command: node src/utils/seedDemoData.js --run-demo-seed');
  process.exit(1);
}

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/BigMart';

const categoriesData = [
  { name: 'Electronics', slug: 'electronics', description: 'Gadgets and devices' },
  { name: 'Fashion', slug: 'fashion', description: 'Clothing and apparel' },
  { name: 'Home & Kitchen', slug: 'home-kitchen', description: 'Home appliances and decor' },
  { name: 'Beauty & Personal Care', slug: 'beauty', description: 'Cosmetics and skincare' },
  { name: 'Grocery & Gourmet', slug: 'grocery', description: 'Daily essentials and food items' },
  { name: 'Sports, Fitness & Outdoors', slug: 'sports', description: 'Sports equipment' },
  { name: 'Books', slug: 'books', description: 'Fiction, non-fiction and educational' },
  { name: 'Toys & Games', slug: 'toys', description: 'Kids toys and board games' }
];

const generateProducts = (categoriesMap, sellerId) => {
  const products = [];
  const brands = {
    'electronics': ['Samsung', 'Apple', 'Sony', 'Boat'],
    'fashion': ['Nike', 'Puma', 'Zara', 'H&M'],
    'home-kitchen': ['Philips', 'Prestige', 'Bajaj', 'Bosch'],
    'beauty': ['Loreal', 'Maybelline', 'Lakme', 'Nivea'],
    'grocery': ['Tata', 'Aashirvaad', 'Nescafe', 'Maggi'],
    'sports': ['Decathlon', 'Nivia', 'Cosco', 'Yonex'],
    'books': ['Penguin', 'HarperCollins', 'Scholastic', 'Pearson'],
    'toys': ['Lego', 'Hasbro', 'Mattel', 'Funskool']
  };

  let skuCounter = 1000;
  
  for (const cat of categoriesData) {
    const categoryId = categoriesMap[cat.slug]._id;
    for (let i = 1; i <= 5; i++) {
      const price = Math.floor(Math.random() * 4000) + 100;
      products.push({
        seller: sellerId,
        category: categoryId,
        name: `Demo ${cat.name} Product ${i}`,
        slug: `demo-${cat.slug}-product-${i}`,
        shortDescription: `A high quality ${cat.name.toLowerCase()} product for all your needs.`,
        description: `This is a detailed description for Demo ${cat.name} Product ${i}. It covers all the features, benefits, and usage instructions perfectly suited for the Indian market.`,
        brand: brands[cat.slug][i % 4],
        sku: `DEMO-${cat.slug.toUpperCase().substring(0,3)}-${skuCounter++}`,
        price: price,
        compareAtPrice: price + Math.floor(price * 0.2),
        costPrice: Math.floor(price * 0.7),
        gstRate: 18,
        stock: Math.floor(Math.random() * 100) + 10,
        status: 'active',
        isPublished: true,
        images: [{
          url: `https://ik.imagekit.io/demo/tr:w-600,h-600/medium_cafe_B1iTdD0C.jpg`, // Placeholder working image
          fileId: `demo_img_${skuCounter}`,
          altText: `Demo ${cat.name} Product ${i}`,
          sortOrder: 0
        }]
      });
    }
  }
  return products;
};

const runSeed = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected.');

    // 2. Setup/Find Users
    let admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      admin = await User.create({ name: 'Demo Admin', email: 'admin@demo.com', password: 'password123', role: 'admin' });
    }

    let customer = await User.findOne({ email: 'customer@demo.com' });
    if (!customer) {
      customer = await User.create({ name: 'Demo Customer', email: 'customer@demo.com', password: 'password123', role: 'customer' });
    }

    let sellerUser = await User.findOne({ email: 'seller@demo.com' });
    if (!sellerUser) {
      sellerUser = await User.create({ name: 'Demo Seller', email: 'seller@demo.com', password: 'password123', role: 'seller' });
    }

    let seller = await Seller.findOne({ user: sellerUser._id });
    if (!seller) {
      seller = await Seller.create({
        user: sellerUser._id,
        businessName: 'Demo India Enterprises',
        businessType: 'private_limited',
        verificationStatus: 'approved'
      });
    }

    // 3. Create Categories Idempotently
    console.log('Seeding Categories...');
    const categoriesMap = {};
    for (const catData of categoriesData) {
      let category = await Category.findOne({ slug: catData.slug });
      if (!category) {
        category = await Category.create({ ...catData, isActive: true, createdBy: admin._id });
      }
      categoriesMap[catData.slug] = category;
    }

    // 4. Create Products
    console.log('Seeding Products...');
    const productsData = generateProducts(categoriesMap, seller._id);
    let newProducts = 0;
    
    for (const prodData of productsData) {
      const existing = await Product.findOne({ sku: prodData.sku, seller: seller._id });
      if (!existing) {
        await Product.create(prodData);
        newProducts++;
      }
    }
    console.log(`Created ${newProducts} new products.`);

    // 5. Create Coupon
    console.log('Seeding Coupon...');
    let coupon = await Coupon.findOne({ code: 'DEMO50' });
    if (!coupon) {
      coupon = await Coupon.create({
        code: 'DEMO50',
        name: 'Demo Flat 50',
        discountType: 'fixed',
        discountValue: 50,
        startDate: new Date(),
        endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
        isActive: true,
        createdBy: admin._id
      });
    }

    console.log('Seed completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Seed script failed:', err);
    process.exit(1);
  }
};

runSeed();
