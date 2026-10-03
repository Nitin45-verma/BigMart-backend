const multer = require('multer');
const ApiError = require('../utils/ApiError');

const storage = multer.memoryStorage();

const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

const fileFilter = (req, file, cb) => {
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(new ApiError(400, 'Invalid file type. Only JPEG, PNG, and WebP images are allowed.'), false);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB maximum file size
  },
  fileFilter
});

/**
 * Single image upload middleware wrapper with clean error handling.
 */
const uploadSingleImage = (req, res, next) => {
  const uploadHandler = upload.single('image');

  uploadHandler(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(new ApiError(400, 'File size exceeds maximum allowed limit of 5 MB'));
        }
        return next(new ApiError(400, `Upload error: ${err.message}`));
      }
      if (err instanceof ApiError) {
        return next(err);
      }
      return next(new ApiError(400, err.message || 'File upload failed'));
    }
    next();
  });
};

module.exports = {
  uploadSingleImage
};
