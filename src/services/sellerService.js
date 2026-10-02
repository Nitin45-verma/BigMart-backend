const SellerApplication = require('../models/SellerApplication');
const User = require('../models/User');
const Seller = require('../models/Seller');
const ApiError = require('../utils/ApiError');
const emailService = require('./emailService');

/**
 * Customer submits a seller application.
 * Rejects unverified email accounts or users with an active pending application.
 */
const applyForSeller = async (userId, applicationData) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Require verified email before seller application
  if (!user.isEmailVerified) {
    throw new ApiError(403, 'Email verification is required before submitting a seller application');
  }

  // Prevent duplicate pending applications
  const pendingApp = await SellerApplication.findOne({ user: userId, status: 'pending' });
  if (pendingApp) {
    throw new ApiError(409, 'You already have a pending seller application');
  }

  const application = await SellerApplication.create({
    user: userId,
    businessName: applicationData.businessName.trim(),
    businessType: applicationData.businessType,
    businessDescription: applicationData.businessDescription ? applicationData.businessDescription.trim() : undefined,
    contactEmail: (applicationData.contactEmail || user.email).toLowerCase().trim(),
    contactPhone: applicationData.contactPhone ? applicationData.contactPhone.trim() : undefined,
    businessAddress: applicationData.businessAddress.trim(),
    city: applicationData.city.trim(),
    state: applicationData.state.trim(),
    country: (applicationData.country || 'India').trim(),
    postalCode: applicationData.postalCode.trim(),
    gstin: applicationData.gstin ? applicationData.gstin.trim() : undefined,
    panNumber: applicationData.panNumber ? applicationData.panNumber.trim() : undefined,
    status: 'pending',
    submittedAt: new Date()
  });

  return application;
};

/**
 * Retrieves the current authenticated user's latest seller application.
 */
const getMySellerApplication = async (userId) => {
  const application = await SellerApplication.findOne({ user: userId }).sort({ createdAt: -1 });
  if (!application) {
    throw new ApiError(404, 'No seller application found');
  }
  return application;
};

/**
 * Cancels a user's pending seller application.
 */
const cancelSellerApplication = async (userId) => {
  const application = await SellerApplication.findOne({ user: userId, status: 'pending' });
  if (!application) {
    throw new ApiError(404, 'No pending seller application to cancel');
  }

  application.status = 'cancelled';
  await application.save();

  return application;
};

/**
 * Admin: Lists all seller applications with filtering and pagination.
 */
const adminListSellerApplications = async ({ status, page = 1, limit = 20 }) => {
  const query = {};
  if (status && ['pending', 'approved', 'rejected', 'cancelled'].includes(status)) {
    query.status = status;
  }

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const applications = await SellerApplication.find(query)
    .populate('user', 'name email avatar role')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum);

  const total = await SellerApplication.countDocuments(query);

  return {
    applications,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum)
  };
};

/**
 * Admin: Gets details of a specific seller application.
 */
const adminGetSellerApplication = async (applicationId) => {
  const application = await SellerApplication.findById(applicationId).populate('user', 'name email avatar role isEmailVerified');
  if (!application) {
    throw new ApiError(404, 'Seller application not found');
  }
  return application;
};

/**
 * Admin: Approves a pending seller application, promoting user role to "seller".
 */
const adminApproveSellerApplication = async (adminUserId, applicationId) => {
  const application = await SellerApplication.findById(applicationId);
  if (!application) {
    throw new ApiError(404, 'Seller application not found');
  }

  if (application.status !== 'pending') {
    throw new ApiError(400, `Cannot approve an application that is currently '${application.status}'`);
  }

  const user = await User.findById(application.user);
  if (!user) {
    throw new ApiError(404, 'Associated user account not found');
  }

  // 1. Promote User role to seller
  user.role = 'seller';
  await user.save();

  // 2. Mark application approved
  application.status = 'approved';
  application.reviewedBy = adminUserId;
  application.reviewedAt = new Date();
  await application.save();

  // 3. Create or update Seller profile record
  let seller = await Seller.findOne({ user: user._id });
  if (!seller) {
    seller = await Seller.create({
      user: user._id,
      businessName: application.businessName,
      businessType: application.businessType,
      gstNumber: application.gstin,
      panNumber: application.panNumber,
      verificationStatus: 'approved'
    });
  } else {
    seller.verificationStatus = 'approved';
    await seller.save();
  }

  // Send approval notification email
  emailService.sendSellerApplicationApprovedEmail({
    toEmail: user.email,
    userName: user.name,
    businessName: application.businessName
  });

  return {
    application,
    userRole: user.role
  };
};

/**
 * Admin: Rejects a pending seller application with a specified reason.
 */
const adminRejectSellerApplication = async (adminUserId, applicationId, rejectionReason) => {
  const application = await SellerApplication.findById(applicationId);
  if (!application) {
    throw new ApiError(404, 'Seller application not found');
  }

  if (application.status !== 'pending') {
    throw new ApiError(400, `Cannot reject an application that is currently '${application.status}'`);
  }

  const user = await User.findById(application.user);
  if (!user) {
    throw new ApiError(404, 'Associated user account not found');
  }

  // Application rejected, user role remains customer
  application.status = 'rejected';
  application.rejectionReason = rejectionReason.trim();
  application.reviewedBy = adminUserId;
  application.reviewedAt = new Date();
  await application.save();

  // Send rejection notification email
  emailService.sendSellerApplicationRejectedEmail({
    toEmail: user.email,
    userName: user.name,
    businessName: application.businessName,
    rejectionReason: application.rejectionReason
  });

  return {
    application,
    userRole: user.role
  };
};

module.exports = {
  applyForSeller,
  getMySellerApplication,
  cancelSellerApplication,
  adminListSellerApplications,
  adminGetSellerApplication,
  adminApproveSellerApplication,
  adminRejectSellerApplication
};
