const mongoose = require('mongoose');
const Coupon = require('../models/Coupon');
const CouponUsage = require('../models/CouponUsage');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const ApiError = require('../utils/ApiError');
const { roundMoney } = require('../utils/moneyUtils');
const AdminAuditLog = require('../models/AdminAuditLog'); // Assuming this exists from step 17

const normalizeCode = (code) => code.trim().toUpperCase();

const validateReferences = async (Model, ids, name) => {
  if (!ids || ids.length === 0) return [];
  const uniqueIds = [...new Set(ids.map(id => id.toString()))];
  for (const id of uniqueIds) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, `Invalid ObjectId format for ${name}`);
    }
  }
  const validDocs = await Model.find({ _id: { $in: uniqueIds } });
  if (validDocs.length !== uniqueIds.length) {
    throw new ApiError(400, `One or more ${name} references are invalid or do not exist`);
  }
  return uniqueIds;
};

const createCoupon = async (adminId, data) => {
  const code = normalizeCode(data.code);
  const existing = await Coupon.findOne({ code });
  if (existing) throw new ApiError(409, 'Coupon code already exists');

  const applicableProducts = await validateReferences(Product, data.applicableProducts || [], 'product');
  const applicableCategories = await validateReferences(mongoose.model('Category'), data.applicableCategories || [], 'category');
  const applicableSellers = await validateReferences(mongoose.model('Seller'), data.applicableSellers || [], 'seller');

  const coupon = await Coupon.create({
    ...data,
    code,
    applicableProducts,
    applicableCategories,
    applicableSellers,
    createdBy: adminId,
    updatedBy: adminId
  });

  if (AdminAuditLog) {
    await AdminAuditLog.create({
      admin: adminId,
      action: 'CREATE_COUPON',
      targetType: 'Coupon',
      targetId: coupon._id,
      metadata: { code: coupon.code }
    });
  }

  return coupon;
};

const updateCoupon = async (adminId, couponId, data) => {
  const coupon = await Coupon.findById(couponId);
  if (!coupon) throw new ApiError(404, 'Coupon not found');

  if (data.applicableProducts) data.applicableProducts = await validateReferences(Product, data.applicableProducts, 'product');
  if (data.applicableCategories) data.applicableCategories = await validateReferences(mongoose.model('Category'), data.applicableCategories, 'category');
  if (data.applicableSellers) data.applicableSellers = await validateReferences(mongoose.model('Seller'), data.applicableSellers, 'seller');

  Object.assign(coupon, { ...data, updatedBy: adminId });
  await coupon.save();

  if (AdminAuditLog) {
    await AdminAuditLog.create({
      admin: adminId,
      action: 'UPDATE_COUPON',
      targetType: 'Coupon',
      targetId: coupon._id,
      metadata: { code: coupon.code }
    });
  }

  return coupon;
};

const updateCouponStatus = async (adminId, couponId, isActive) => {
  if (!mongoose.Types.ObjectId.isValid(couponId)) {
    throw new ApiError(400, 'Invalid coupon ID');
  }
  const coupon = await Coupon.findByIdAndUpdate(
    couponId,
    { isActive, updatedBy: adminId },
    { new: true, runValidators: true }
  );
  if (!coupon) throw new ApiError(404, 'Coupon not found');

  if (AdminAuditLog) {
    await AdminAuditLog.create({
      admin: adminId,
      action: isActive ? 'ACTIVATE_COUPON' : 'DEACTIVATE_COUPON',
      targetType: 'Coupon',
      targetId: coupon._id,
      metadata: { code: coupon.code }
    });
  }
  return coupon;
};

const getCoupons = async (filters, page = 1, limit = 20) => {
  const skip = (page - 1) * limit;
  const query = {};
  if (filters.isActive !== undefined) query.isActive = filters.isActive;
  if (filters.discountType) query.discountType = filters.discountType;
  if (filters.search) {
    query.$or = [
      { code: { $regex: filters.search, $options: 'i' } },
      { name: { $regex: filters.search, $options: 'i' } }
    ];
  }
  
  const now = new Date();
  if (filters.expired === 'true') {
    query.endDate = { $lt: now };
  } else if (filters.upcoming === 'true') {
    query.startDate = { $gt: now };
  } else if (filters.active === 'true') {
    query.startDate = { $lte: now };
    query.endDate = { $gte: now };
  }

  const coupons = await Coupon.find(query).skip(skip).limit(limit).sort({ createdAt: -1 });
  const total = await Coupon.countDocuments(query);
  return { coupons, total, page, limit, totalPages: Math.ceil(total / limit) };
};

const getCouponById = async (couponId) => {
  const coupon = await Coupon.findById(couponId);
  if (!coupon) throw new ApiError(404, 'Coupon not found');
  return coupon;
};

const deleteCoupon = async (adminId, couponId) => {
  const usageCount = await CouponUsage.countDocuments({ coupon: couponId });
  let coupon;
  if (usageCount > 0) {
    // Soft delete/deactivate if usage exists
    coupon = await Coupon.findByIdAndUpdate(couponId, { isActive: false, updatedBy: adminId }, { new: true });
    if (!coupon) throw new ApiError(404, 'Coupon not found');
  } else {
    coupon = await Coupon.findByIdAndDelete(couponId);
    if (!coupon) throw new ApiError(404, 'Coupon not found');
  }

  if (AdminAuditLog) {
    await AdminAuditLog.create({
      admin: adminId,
      action: 'DELETE_COUPON',
      targetType: 'Coupon',
      targetId: couponId,
      metadata: { code: coupon.code, softDeleted: usageCount > 0 }
    });
  }
  return { message: usageCount > 0 ? 'Coupon deactivated due to existing usage history' : 'Coupon deleted successfully' };
};

const calculateEligibleSubtotal = async (cartItems, coupon) => {
  let eligibleSubtotal = 0;
  
  // Need to populate product details if not already done, but usually cart items passed here should have it.
  // Wait, the validation logic needs to pull fresh DB info.
  // We'll do it securely: read directly from Product model.
  const productIds = cartItems.map(item => item.product._id || item.product);
  const products = await Product.find({ _id: { $in: productIds } });
  
  const productMap = {};
  products.forEach(p => productMap[p._id.toString()] = p);

  for (const item of cartItems) {
    const prodId = (item.product._id || item.product).toString();
    const product = productMap[prodId];
    if (!product || product.status !== 'active' || !product.isPublished) continue;
    
    // Check constraints: An item is eligible if it matches ALL configured restriction dimensions.
    const passesProduct = coupon.applicableProducts.length === 0 || coupon.applicableProducts.map(id=>id.toString()).includes(prodId);
    const passesCategory = coupon.applicableCategories.length === 0 || coupon.applicableCategories.map(id=>id.toString()).includes(product.category.toString());
    const passesSeller = coupon.applicableSellers.length === 0 || coupon.applicableSellers.map(id=>id.toString()).includes(product.seller.toString());

    if (passesProduct && passesCategory && passesSeller) {
      const availableStock = product.stock || 0;
      const effectiveQty = Math.min(item.quantity, availableStock > 0 ? availableStock : item.quantity);
      if (effectiveQty > 0) {
        eligibleSubtotal = roundMoney(eligibleSubtotal + (roundMoney(product.price) * effectiveQty));
      }
    }
  }

  return eligibleSubtotal;
};

const validateCouponForCustomer = async (userId, code) => {
  const normalizedCode = normalizeCode(code);
  const coupon = await Coupon.findOne({ code: normalizedCode });
  if (!coupon) throw new ApiError(404, 'Coupon not found');

  if (!coupon.isActive) throw new ApiError(400, 'Coupon is inactive');
  const now = new Date();
  if (now < coupon.startDate) throw new ApiError(400, 'Coupon is not active yet');
  if (now > coupon.endDate) throw new ApiError(400, 'Coupon has expired');

  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    throw new ApiError(400, 'Coupon usage limit reached');
  }

  if (coupon.perCustomerLimit !== null) {
    const userUsageCount = await CouponUsage.countDocuments({ coupon: coupon._id, customer: userId });
    if (userUsageCount >= coupon.perCustomerLimit) {
      throw new ApiError(400, 'You have already used this coupon');
    }
  }

  const cart = await Cart.findOne({ user: userId });
  if (!cart || !cart.items || cart.items.length === 0) {
    throw new ApiError(400, 'Cart is empty');
  }

  const eligibleSubtotal = await calculateEligibleSubtotal(cart.items, coupon);
  
  if (eligibleSubtotal === 0) {
    throw new ApiError(400, 'No eligible products in cart');
  }

  if (coupon.minCartValue > 0 && eligibleSubtotal < coupon.minCartValue) {
    throw new ApiError(400, `Cart does not meet minimum value of ${coupon.minCartValue}`);
  }

  let discountAmount = 0;
  if (coupon.discountType === 'percentage') {
    discountAmount = roundMoney((eligibleSubtotal * coupon.discountValue) / 100);
    if (coupon.maxDiscount !== null && discountAmount > coupon.maxDiscount) {
      discountAmount = coupon.maxDiscount;
    }
  } else if (coupon.discountType === 'fixed') {
    discountAmount = coupon.discountValue;
  }

  // Final sanity check: discount cannot exceed eligible subtotal
  if (discountAmount > eligibleSubtotal) {
    discountAmount = eligibleSubtotal;
  }

  return {
    coupon,
    discountAmount,
    eligibleSubtotal
  };
};

module.exports = {
  createCoupon,
  updateCoupon,
  updateCouponStatus,
  getCoupons,
  getCouponById,
  deleteCoupon,
  validateCouponForCustomer,
  calculateEligibleSubtotal
};
