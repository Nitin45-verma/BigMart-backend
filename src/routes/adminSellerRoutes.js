const express = require('express');
const sellerController = require('../controllers/sellerController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const {
  validateApplicationIdParam,
  validateAdminRejectionInput
} = require('../validators/sellerValidator');

const router = express.Router();

// Require authentication and Admin role for all admin seller-application routes
router.use(authenticate, authorizeRoles('admin'));

/**
 * @route GET /api/v1/admin/seller-applications
 * @desc  List all seller applications with status filtering and pagination
 * @access Admin only
 */
router.get('/', sellerController.adminListApplications);

/**
 * @route GET /api/v1/admin/seller-applications/:applicationId
 * @desc  Get details of a specific seller application
 * @access Admin only
 */
router.get('/:applicationId', validateApplicationIdParam, sellerController.adminGetApplication);

/**
 * @route PATCH /api/v1/admin/seller-applications/:applicationId/approve
 * @desc  Approve a pending seller application and promote user role to "seller"
 * @access Admin only
 */
router.patch(
  '/:applicationId/approve',
  validateApplicationIdParam,
  sellerController.adminApproveApplication
);

/**
 * @route PATCH /api/v1/admin/seller-applications/:applicationId/reject
 * @desc  Reject a pending seller application with a specified reason
 * @access Admin only
 */
router.patch(
  '/:applicationId/reject',
  validateApplicationIdParam,
  validateAdminRejectionInput,
  sellerController.adminRejectApplication
);

module.exports = router;
