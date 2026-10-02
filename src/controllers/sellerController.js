const sellerService = require('../services/sellerService');

/**
 * Controller: POST /api/v1/seller/apply
 * Customer submits a seller application
 */
const apply = async (req, res, next) => {
  try {
    const application = await sellerService.applyForSeller(req.user.userId, req.body);
    res.status(201).json({
      success: true,
      message: 'Seller application submitted successfully and is pending review',
      data: { application }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: GET /api/v1/seller/application
 * Customer views their own latest seller application status
 */
const getApplication = async (req, res, next) => {
  try {
    const application = await sellerService.getMySellerApplication(req.user.userId);
    res.status(200).json({
      success: true,
      data: { application }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: PATCH /api/v1/seller/application/cancel
 * Customer cancels their pending seller application
 */
const cancelApplication = async (req, res, next) => {
  try {
    const application = await sellerService.cancelSellerApplication(req.user.userId);
    res.status(200).json({
      success: true,
      message: 'Seller application cancelled successfully',
      data: { application }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: GET /api/v1/admin/seller-applications
 * Admin lists all seller applications
 */
const adminListApplications = async (req, res, next) => {
  try {
    const result = await sellerService.adminListSellerApplications(req.query);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: GET /api/v1/admin/seller-applications/:applicationId
 * Admin gets details of a specific seller application
 */
const adminGetApplication = async (req, res, next) => {
  try {
    const application = await sellerService.adminGetSellerApplication(req.params.applicationId);
    res.status(200).json({
      success: true,
      data: { application }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: PATCH /api/v1/admin/seller-applications/:applicationId/approve
 * Admin approves a pending seller application
 */
const adminApproveApplication = async (req, res, next) => {
  try {
    const result = await sellerService.adminApproveSellerApplication(req.user.userId, req.params.applicationId);
    res.status(200).json({
      success: true,
      message: 'Seller application approved successfully. User role updated to seller.',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: PATCH /api/v1/admin/seller-applications/:applicationId/reject
 * Admin rejects a pending seller application
 */
const adminRejectApplication = async (req, res, next) => {
  try {
    const { rejectionReason } = req.body;
    const result = await sellerService.adminRejectSellerApplication(req.user.userId, req.params.applicationId, rejectionReason);
    res.status(200).json({
      success: true,
      message: 'Seller application rejected',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  apply,
  getApplication,
  cancelApplication,
  adminListApplications,
  adminGetApplication,
  adminApproveApplication,
  adminRejectApplication
};
