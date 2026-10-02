const express = require('express');
const productController = require('../controllers/productController');

const router = express.Router();

// Public product catalog endpoints (no authentication required)
router.get('/', productController.getPublicProducts);
router.get('/category/:categorySlug', productController.getPublicProductsByCategorySlug);
router.get('/:slug', productController.getPublicProductBySlug);

module.exports = router;
