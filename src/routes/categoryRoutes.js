const express = require('express');
const categoryController = require('../controllers/categoryController');
const { validateCategoryIdParam } = require('../validators/categoryValidator');

const router = express.Router();

// Public category browsing endpoints (no authentication required)
router.get('/', categoryController.getCategories);
router.get('/slug/:slug', categoryController.getCategoryBySlug);
router.get('/:categoryId', validateCategoryIdParam, categoryController.getCategoryById);

module.exports = router;
