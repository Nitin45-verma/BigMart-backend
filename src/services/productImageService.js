const Product = require('../models/Product');
const Seller = require('../models/Seller');
const ApiError = require('../utils/ApiError');
const imageKitService = require('./imageKitService');

/**
 * Seller uploads a product image to ImageKit and stores metadata in Product document.
 */
const uploadProductImage = async (userId, productId, file, altText) => {
  const seller = await Seller.findOne({ user: userId });
  if (!seller || seller.verificationStatus !== 'approved') {
    throw new ApiError(403, 'Only active approved sellers can upload product images');
  }

  const product = await Product.findOne({ _id: productId, seller: seller._id });
  if (!product) {
    throw new ApiError(404, 'Product not found or access denied');
  }

  if (!file || !file.buffer) {
    throw new ApiError(400, 'Image file is required');
  }

  // Server-side enforcement of maximum 10 images per product
  if (product.images.length >= 10) {
    throw new ApiError(409, 'Maximum limit of 10 images per product reached');
  }

  const sanitizedAltText = altText && typeof altText === 'string' ? altText.trim().substring(0, 150) : undefined;

  // Server-controlled folder and unique file name
  const folder = `/bigmart/products/${productId}`;
  const fileName = `product-${productId}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  let uploadResult;
  let isLiveUpload = false;

  if (imageKitService.isConfigured()) {
    try {
      uploadResult = await imageKitService.uploadImage({
        fileBuffer: file.buffer,
        fileName,
        folder
      });
      isLiveUpload = true;
    } catch (err) {
      throw new ApiError(502, `ImageKit upload failed: ${err.message}`);
    }
  } else {
    // Development / test fallback when live credentials are not set
    uploadResult = {
      fileId: `ik_file_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      url: `https://ik.imagekit.io/bigmart/products/${productId}/${fileName}.jpg`
    };
  }

  // Calculate sortOrder: first image is 0, subsequent images get next incremental sortOrder
  const nextSortOrder =
    product.images.length === 0 ? 0 : Math.max(...product.images.map((img) => img.sortOrder), -1) + 1;

  const newImageRecord = {
    url: uploadResult.url,
    fileId: uploadResult.fileId,
    altText: sanitizedAltText,
    sortOrder: nextSortOrder
  };

  product.images.push(newImageRecord);

  try {
    await product.save();
  } catch (dbError) {
    // Rollback / Cleanup: Delete orphaned file from ImageKit if MongoDB save fails
    if (isLiveUpload && uploadResult.fileId) {
      try {
        await imageKitService.deleteImage(uploadResult.fileId);
      } catch (cleanupErr) {
        // Log non-secret diagnostic cleanup failure
        console.error(`[Cleanup Error] Failed to delete orphaned ImageKit file ${uploadResult.fileId}: ${cleanupErr.message}`);
      }
    }
    throw dbError;
  }

  return {
    image: newImageRecord,
    product
  };
};

/**
 * Seller updates image metadata (e.g. altText).
 */
const updateProductImageMetadata = async (userId, productId, fileId, { altText }) => {
  const seller = await Seller.findOne({ user: userId });
  if (!seller || seller.verificationStatus !== 'approved') {
    throw new ApiError(403, 'Only active approved sellers can update product images');
  }

  const product = await Product.findOne({ _id: productId, seller: seller._id });
  if (!product) {
    throw new ApiError(404, 'Product not found or access denied');
  }

  const imageItem = product.images.find((img) => img.fileId === fileId);
  if (!imageItem) {
    throw new ApiError(404, 'Image fileId not found in this product');
  }

  if (altText !== undefined) {
    imageItem.altText = altText ? altText.trim().substring(0, 150) : undefined;
  }

  await product.save();

  return {
    image: imageItem,
    product
  };
};

/**
 * Seller deletes a product image from ImageKit and removes metadata from Product.
 */
const deleteProductImage = async (userId, productId, fileId) => {
  const seller = await Seller.findOne({ user: userId });
  if (!seller || seller.verificationStatus !== 'approved') {
    throw new ApiError(403, 'Only active approved sellers can delete product images');
  }

  const product = await Product.findOne({ _id: productId, seller: seller._id });
  if (!product) {
    throw new ApiError(404, 'Product not found or access denied');
  }

  const imageIndex = product.images.findIndex((img) => img.fileId === fileId);
  if (imageIndex === -1) {
    throw new ApiError(404, 'Image fileId not found in this product');
  }

  // If ImageKit live integration is configured, attempt to delete file from ImageKit
  if (imageKitService.isConfigured()) {
    try {
      await imageKitService.deleteImage(fileId);
    } catch (ikErr) {
      console.warn(`[ImageKit Warning] File deletion on ImageKit failed for ${fileId}: ${ikErr.message}`);
    }
  }

  // Remove image metadata from product array
  product.images.splice(imageIndex, 1);

  // Recalculate sortOrder for remaining images (0, 1, 2...)
  product.images.sort((a, b) => a.sortOrder - b.sortOrder);
  product.images.forEach((img, idx) => {
    img.sortOrder = idx;
  });

  await product.save();

  return {
    message: 'Image deleted successfully',
    images: product.images
  };
};

/**
 * Seller reorders product images based on an array of fileIds.
 */
const reorderProductImages = async (userId, productId, imageIds) => {
  const seller = await Seller.findOne({ user: userId });
  if (!seller || seller.verificationStatus !== 'approved') {
    throw new ApiError(403, 'Only active approved sellers can reorder product images');
  }

  const product = await Product.findOne({ _id: productId, seller: seller._id });
  if (!product) {
    throw new ApiError(404, 'Product not found or access denied');
  }

  if (imageIds.length !== product.images.length) {
    throw new ApiError(400, 'Reorder imageIds count must match current product images count');
  }

  const existingFileIds = new Set(product.images.map((img) => img.fileId));
  const invalidIds = imageIds.filter((id) => !existingFileIds.has(id));

  if (invalidIds.length > 0) {
    throw new ApiError(400, `Unknown image fileId(s) in reorder payload: ${invalidIds.join(', ')}`);
  }

  // Map fileIds to image objects and assign new sortOrder based on array index
  const imageMap = new Map(product.images.map((img) => [img.fileId, img]));
  const reorderedImages = imageIds.map((id, index) => {
    const img = imageMap.get(id);
    img.sortOrder = index;
    return img;
  });

  product.images = reorderedImages;
  await product.save();

  return {
    message: 'Images reordered successfully',
    images: product.images
  };
};

module.exports = {
  uploadProductImage,
  updateProductImageMetadata,
  deleteProductImage,
  reorderProductImages
};
