const ApiError = require('../utils/ApiError');

/**
 * Validates image metadata update input (e.g. altText).
 * Blocks attempts to modify system-controlled attributes like fileId, url, sortOrder.
 */
const validateImageMetadataUpdate = (req, res, next) => {
  const protectedFields = ['fileId', 'url', 'sortOrder', 'path', 'filePath', 'folder', 'seller'];
  for (const field of protectedFields) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      return next(new ApiError(400, `Setting field '${field}' is not allowed in image metadata update`));
    }
  }

  const { altText } = req.body;
  if (altText !== undefined) {
    if (typeof altText !== 'string') {
      return next(new ApiError(400, 'altText must be a string'));
    }
    if (altText.trim().length > 150) {
      return next(new ApiError(400, 'altText cannot exceed 150 characters'));
    }
  }

  next();
};

/**
 * Validates image reordering input payload.
 */
const validateImageReorder = (req, res, next) => {
  const { imageIds } = req.body;

  if (!imageIds || !Array.isArray(imageIds)) {
    return next(new ApiError(400, 'imageIds must be an array of image fileId strings'));
  }

  if (imageIds.length === 0) {
    return next(new ApiError(400, 'imageIds array cannot be empty'));
  }

  const hasNonString = imageIds.some((id) => typeof id !== 'string' || id.trim().length === 0);
  if (hasNonString) {
    return next(new ApiError(400, 'All items in imageIds must be non-empty strings'));
  }

  const uniqueIds = new Set(imageIds);
  if (uniqueIds.size !== imageIds.length) {
    return next(new ApiError(400, 'Duplicate image IDs are not allowed in reorder array'));
  }

  next();
};

module.exports = {
  validateImageMetadataUpdate,
  validateImageReorder
};
