const categoryService = require('../services/categoryService');

/**
 * Admin: Create category
 */
const createCategory = async (req, res, next) => {
  try {
    const category = await categoryService.createCategory(req.user.userId, req.body);
    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: { category }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin / Public: List categories
 */
const getCategories = async (req, res, next) => {
  try {
    const includeInactive = req.query.includeInactive === 'true' && req.user?.role === 'admin';
    const categories = await categoryService.getCategories(includeInactive);
    res.status(200).json({
      success: true,
      data: { categories }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get category by ID
 */
const getCategoryById = async (req, res, next) => {
  try {
    const includeInactive = req.user?.role === 'admin';
    const category = await categoryService.getCategoryById(req.params.categoryId, includeInactive);
    res.status(200).json({
      success: true,
      data: { category }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Public: Get category by slug
 */
const getCategoryBySlug = async (req, res, next) => {
  try {
    const category = await categoryService.getCategoryBySlug(req.params.slug);
    res.status(200).json({
      success: true,
      data: { category }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Update category
 */
const updateCategory = async (req, res, next) => {
  try {
    const category = await categoryService.updateCategory(req.params.categoryId, req.body);
    res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      data: { category }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Delete category
 */
const deleteCategory = async (req, res, next) => {
  try {
    const result = await categoryService.deleteCategory(req.params.categoryId);
    res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCategory,
  getCategories,
  getCategoryById,
  getCategoryBySlug,
  updateCategory,
  deleteCategory
};
