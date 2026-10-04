const couponService = require('../services/couponService');

const createCoupon = async (req, res, next) => {
  try {
    const coupon = await couponService.createCoupon(req.user.userId, req.body);
    res.status(201).json({ success: true, data: coupon });
  } catch (error) {
    next(error);
  }
};

const updateCoupon = async (req, res, next) => {
  try {
    const coupon = await couponService.updateCoupon(req.user.userId, req.params.couponId, req.body);
    res.status(200).json({ success: true, data: coupon });
  } catch (error) {
    next(error);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const coupon = await couponService.updateCouponStatus(req.user.userId, req.params.couponId, req.body.isActive);
    res.status(200).json({ success: true, data: coupon });
  } catch (error) {
    next(error);
  }
};

const getCoupons = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const filters = {
      isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
      discountType: req.query.discountType,
      search: req.query.search,
      expired: req.query.expired,
      upcoming: req.query.upcoming,
      active: req.query.active
    };

    const data = await couponService.getCoupons(filters, page, limit);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const getCoupon = async (req, res, next) => {
  try {
    const coupon = await couponService.getCouponById(req.params.couponId);
    res.status(200).json({ success: true, data: coupon });
  } catch (error) {
    next(error);
  }
};

const deleteCoupon = async (req, res, next) => {
  try {
    const result = await couponService.deleteCoupon(req.user.userId, req.params.couponId);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCoupon,
  updateCoupon,
  updateStatus,
  getCoupons,
  getCoupon,
  deleteCoupon
};
