const ImageKit = require('imagekit');

/**
 * ImageKit Configuration & SDK Service wrapper.
 * Accesses credentials ONLY via process.env.
 * Never exposes or logs secret private key.
 */
let imagekitInstance = null;

const getPublicKey = () => process.env.IMAGEKIT_PUBLIC_KEY || '';
const getPrivateKey = () => process.env.IMAGEKIT_PRIVATE_KEY || '';
const getUrlEndpoint = () => process.env.IMAGEKIT_URL_ENDPOINT || '';

const isConfigured = () => {
  return Boolean(getPublicKey() && getPrivateKey() && getUrlEndpoint());
};

const getImageKitInstance = () => {
  if (!imagekitInstance && isConfigured()) {
    imagekitInstance = new ImageKit({
      publicKey: getPublicKey(),
      privateKey: getPrivateKey(),
      urlEndpoint: getUrlEndpoint()
    });
  }
  return imagekitInstance;
};

/**
 * Uploads file buffer to ImageKit.
 */
const uploadImage = async ({ fileBuffer, fileName, folder }) => {
  const ik = getImageKitInstance();
  if (!ik) {
    throw new Error('ImageKit credentials are not configured');
  }

  const response = await ik.upload({
    file: fileBuffer,
    fileName,
    folder,
    useUniqueFileName: false
  });

  return {
    url: response.url,
    fileId: response.fileId,
    filePath: response.filePath
  };
};

/**
 * Deletes file from ImageKit by fileId.
 */
const deleteImage = async (fileId) => {
  const ik = getImageKitInstance();
  if (!ik) {
    throw new Error('ImageKit credentials are not configured');
  }

  const response = await ik.deleteFile(fileId);
  return response;
};

module.exports = {
  isConfigured,
  getImageKitInstance,
  uploadImage,
  deleteImage
};
