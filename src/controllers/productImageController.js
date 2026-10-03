const productImageService = require('../services/productImageService');

/**
 * Seller: Upload product image to ImageKit and attach to product
 */
const uploadImage = async (req, res, next) => {
  try {
    const result = await productImageService.uploadProductImage(
      req.user.userId,
      req.params.productId,
      req.file,
      req.body.altText
    );
    res.status(201).json({
      success: true,
      message: 'Product image uploaded successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Seller: Update product image metadata (e.g. altText)
 */
const updateImageMetadata = async (req, res, next) => {
  try {
    const result = await productImageService.updateProductImageMetadata(
      req.user.userId,
      req.params.productId,
      req.params.fileId,
      req.body
    );
    res.status(200).json({
      success: true,
      message: 'Product image metadata updated successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Seller: Delete product image from ImageKit and remove from product
 */
const deleteImage = async (req, res, next) => {
  try {
    const result = await productImageService.deleteProductImage(
      req.user.userId,
      req.params.productId,
      req.params.fileId
    );
    res.status(200).json({
      success: true,
      message: result.message,
      data: { images: result.images }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Seller: Reorder product images
 */
const reorderImages = async (req, res, next) => {
  try {
    const result = await productImageService.reorderProductImages(
      req.user.userId,
      req.params.productId,
      req.body.imageIds
    );
    res.status(200).json({
      success: true,
      message: result.message,
      data: { images: result.images }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadImage,
  updateImageMetadata,
  deleteImage,
  reorderImages
};
