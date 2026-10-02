const Category = require('../models/Category');
const Product = require('../models/Product');
const ApiError = require('../utils/ApiError');
const { slugify } = require('../utils/slugUtils');

/**
 * Admin: Create a new category.
 */
const createCategory = async (adminUserId, categoryData) => {
  const name = categoryData.name.trim();
  const slug = categoryData.slug ? slugify(categoryData.slug) : slugify(name);

  // Ensure slug uniqueness
  const existingSlug = await Category.findOne({ slug });
  if (existingSlug) {
    throw new ApiError(409, `Category slug '${slug}' already exists`);
  }

  // If parent category is specified, verify it exists
  if (categoryData.parentCategory) {
    const parent = await Category.findById(categoryData.parentCategory);
    if (!parent) {
      throw new ApiError(400, 'Parent category not found');
    }
  }

  const category = await Category.create({
    name,
    slug,
    description: categoryData.description ? categoryData.description.trim() : undefined,
    parentCategory: categoryData.parentCategory || null,
    image: categoryData.image || undefined,
    isActive: categoryData.isActive !== undefined ? categoryData.isActive : true,
    sortOrder: categoryData.sortOrder || 0,
    createdBy: adminUserId
  });

  return category;
};

/**
 * Admin / Public: List categories.
 * Public view returns active categories only. Admin view can list all categories.
 */
const getCategories = async (includeInactive = false) => {
  const query = includeInactive ? {} : { isActive: true };
  const categories = await Category.find(query)
    .populate('parentCategory', 'name slug')
    .sort({ sortOrder: 1, name: 1 });

  return categories;
};

/**
 * Get category by ID.
 */
const getCategoryById = async (categoryId, includeInactive = false) => {
  const query = { _id: categoryId };
  if (!includeInactive) {
    query.isActive = true;
  }

  const category = await Category.findOne(query).populate('parentCategory', 'name slug');
  if (!category) {
    throw new ApiError(404, 'Category not found');
  }

  return category;
};

/**
 * Public: Get active category by slug.
 */
const getCategoryBySlug = async (slug) => {
  const category = await Category.findOne({
    slug: slug.toLowerCase().trim(),
    isActive: true
  }).populate('parentCategory', 'name slug');

  if (!category) {
    throw new ApiError(404, 'Category not found');
  }

  return category;
};

/**
 * Admin: Update category details.
 */
const updateCategory = async (categoryId, updateData) => {
  const category = await Category.findById(categoryId);
  if (!category) {
    throw new ApiError(404, 'Category not found');
  }

  if (updateData.name && updateData.name.trim() !== category.name) {
    const newSlug = slugify(updateData.name);
    const slugExists = await Category.findOne({ slug: newSlug, _id: { $ne: categoryId } });
    if (slugExists) {
      throw new ApiError(409, `Category slug '${newSlug}' already exists`);
    }
    category.name = updateData.name.trim();
    category.slug = newSlug;
  }

  if (updateData.parentCategory !== undefined) {
    if (updateData.parentCategory) {
      if (updateData.parentCategory.toString() === categoryId.toString()) {
        throw new ApiError(400, 'Category cannot be its own parent');
      }
      const parent = await Category.findById(updateData.parentCategory);
      if (!parent) {
        throw new ApiError(400, 'Parent category not found');
      }
      category.parentCategory = updateData.parentCategory;
    } else {
      category.parentCategory = null;
    }
  }

  if (updateData.description !== undefined) {
    category.description = updateData.description ? updateData.description.trim() : '';
  }

  if (updateData.image !== undefined) {
    category.image = updateData.image;
  }

  if (updateData.isActive !== undefined) {
    category.isActive = updateData.isActive;
  }

  if (updateData.sortOrder !== undefined) {
    category.sortOrder = updateData.sortOrder;
  }

  await category.save();
  return category;
};

/**
 * Admin: Delete category safely.
 * Blocks deletion if products are associated with the category.
 */
const deleteCategory = async (categoryId) => {
  const category = await Category.findById(categoryId);
  if (!category) {
    throw new ApiError(404, 'Category not found');
  }

  // Safety check: Prevent deletion if products exist for this category
  const productCount = await Product.countDocuments({
    $or: [{ category: categoryId }, { subCategory: categoryId }]
  });

  if (productCount > 0) {
    throw new ApiError(
      409,
      `Cannot delete category containing ${productCount} associated products. Deactivate the category (isActive = false) instead.`
    );
  }

  await Category.findByIdAndDelete(categoryId);
  return { message: 'Category deleted successfully' };
};

module.exports = {
  createCategory,
  getCategories,
  getCategoryById,
  getCategoryBySlug,
  updateCategory,
  deleteCategory
};
