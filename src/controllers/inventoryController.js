const inventoryService = require('../services/inventoryService');

const getSellerInventory = async (req, res, next) => {
  try {
    const result = await inventoryService.getSellerInventory(req.user.userId, req.query);
    res.status(200).json({ success: true, message: 'Seller inventory retrieved successfully', data: result });
  } catch (err) {
    next(err);
  }
};

const getAdminInventory = async (req, res, next) => {
  try {
    const result = await inventoryService.getAdminInventory(req.query);
    res.status(200).json({ success: true, message: 'Admin inventory retrieved successfully', data: result });
  } catch (err) {
    next(err);
  }
};

const stockIn = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { quantity, reason } = req.body;
    const { product, movement } = await inventoryService.stockIn(req.user.userId, productId, quantity, reason);
    res.status(200).json({
      success: true,
      message: 'Stock increased successfully',
      data: {
        productId: product._id,
        previousStock: movement.previousStock,
        newStock: movement.newStock,
        movementId: movement._id
      }
    });
  } catch (err) {
    next(err);
  }
};

const stockOut = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { quantity, reason } = req.body;
    const { product, movement } = await inventoryService.stockOut(req.user.userId, productId, quantity, reason);
    res.status(200).json({
      success: true,
      message: 'Stock decreased successfully',
      data: {
        productId: product._id,
        previousStock: movement.previousStock,
        newStock: movement.newStock,
        movementId: movement._id
      }
    });
  } catch (err) {
    next(err);
  }
};

const adjustStock = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { adjustment, reason } = req.body;
    const { product, movement } = await inventoryService.adjustStock(req.user.userId, productId, adjustment, reason);
    res.status(200).json({
      success: true,
      message: 'Stock adjusted successfully',
      data: {
        productId: product._id,
        previousStock: movement.previousStock,
        newStock: movement.newStock,
        movementId: movement._id
      }
    });
  } catch (err) {
    next(err);
  }
};

const updateThreshold = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { lowStockThreshold } = req.body;
    const product = await inventoryService.updateThreshold(req.user.userId, productId, lowStockThreshold);
    res.status(200).json({
      success: true,
      message: 'Low stock threshold updated',
      data: {
        productId: product._id,
        lowStockThreshold: product.lowStockThreshold
      }
    });
  } catch (err) {
    next(err);
  }
};

const getMovements = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const result = await inventoryService.getMovements(req.user.userId, productId, req.query);
    res.status(200).json({ success: true, message: 'Inventory movements retrieved', data: result });
  } catch (err) {
    next(err);
  }
};

const getAdminMovements = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const result = await inventoryService.getAdminMovements(productId, req.query);
    res.status(200).json({ success: true, message: 'Admin inventory movements retrieved', data: result });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getSellerInventory,
  getAdminInventory,
  stockIn,
  stockOut,
  adjustStock,
  updateThreshold,
  getMovements,
  getAdminMovements
};
