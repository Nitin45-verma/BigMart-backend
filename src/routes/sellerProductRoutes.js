const express = require('express');
const productController = require('../controllers/productController');
const productImageController = require('../controllers/productImageController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { uploadSingleImage } = require('../middleware/uploadMiddleware');
const { validateProductInput, validateProductIdParam } = require('../validators/productValidator');
const { validateImageMetadataUpdate, validateImageReorder } = require('../validators/imageValidator');

const router = express.Router();

// All seller product routes require authentication and seller role
router.use(authenticate, authorizeRoles('seller'));

// Product CRUD routes
router.post('/', validateProductInput, productController.createProduct);
router.get('/', productController.getSellerProducts);
router.get('/:productId', validateProductIdParam, productController.getSellerProductById);
router.patch('/:productId', validateProductIdParam, validateProductInput, productController.updateSellerProduct);
router.delete('/:productId', validateProductIdParam, productController.deleteSellerProduct);

// Product Image routes
router.post(
  '/:productId/images',
  validateProductIdParam,
  uploadSingleImage,
  productImageController.uploadImage
);

router.patch(
  '/:productId/images/reorder',
  validateProductIdParam,
  validateImageReorder,
  productImageController.reorderImages
);

router.patch(
  '/:productId/images/:fileId',
  validateProductIdParam,
  validateImageMetadataUpdate,
  productImageController.updateImageMetadata
);

router.delete(
  '/:productId/images/:fileId',
  validateProductIdParam,
  productImageController.deleteImage
);

module.exports = router;
