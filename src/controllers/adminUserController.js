const adminUserService = require('../services/adminUserService');

const getUsers = async (req, res, next) => {
  try {
    const result = await adminUserService.getUsers(req.query);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const getUserById = async (req, res, next) => {
  try {
    const data = await adminUserService.getUserById(req.params.userId);
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

const blockUser = async (req, res, next) => {
  try {
    const result = await adminUserService.blockUser(req.user.userId, req.params.userId, req);
    res.status(200).json({
      success: true,
      message: result.message,
      data: result.user
    });
  } catch (error) {
    next(error);
  }
};

const unblockUser = async (req, res, next) => {
  try {
    const result = await adminUserService.unblockUser(req.user.userId, req.params.userId, req);
    res.status(200).json({
      success: true,
      message: result.message,
      data: result.user
    });
  } catch (error) {
    next(error);
  }
};

const updateUserRole = async (req, res, next) => {
  try {
    const result = await adminUserService.updateUserRole(
      req.user.userId,
      req.params.userId,
      req.body.role,
      req
    );
    res.status(200).json({
      success: true,
      message: result.message,
      data: result.user
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUsers,
  getUserById,
  blockUser,
  unblockUser,
  updateUserRole
};
