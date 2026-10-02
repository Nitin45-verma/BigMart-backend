const express = require('express');
const categoryController = require('../controllers/categoryController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { validateCategoryInput, validateCategoryIdParam } = require('../validators/categoryValidator');

const router = express.Router();

// All admin category routes require authentication and admin role
router.use(authenticate, authorizeRoles('admin'));

router.post('/', validateCategoryInput, categoryController.createCategory);
router.get('/', categoryController.getCategories);
router.get('/:categoryId', validateCategoryIdParam, categoryController.getCategoryById);
router.patch('/:categoryId', validateCategoryIdParam, validateCategoryInput, categoryController.updateCategory);
router.delete('/:categoryId', validateCategoryIdParam, categoryController.deleteCategory);

module.exports = router;
