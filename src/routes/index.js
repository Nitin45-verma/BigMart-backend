const express = require('express');
const healthRoutes = require('./health.routes');
const authRoutes = require('./authRoutes');
const testRoutes = require('./testRoutes');
const userRoutes = require('./userRoutes');
const sellerRoutes = require('./sellerRoutes');
const adminSellerRoutes = require('./adminSellerRoutes');
const adminCategoryRoutes = require('./adminCategoryRoutes');
const categoryRoutes = require('./categoryRoutes');
const sellerProductRoutes = require('./sellerProductRoutes');
const productRoutes = require('./productRoutes');

const router = express.Router();

// Register v1 routes
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/test', testRoutes);
router.use('/users', userRoutes);
router.use('/seller', sellerRoutes);
router.use('/seller/products', sellerProductRoutes);
router.use('/admin/seller-applications', adminSellerRoutes);
router.use('/admin/categories', adminCategoryRoutes);
router.use('/categories', categoryRoutes);
router.use('/products', productRoutes);

module.exports = router;
