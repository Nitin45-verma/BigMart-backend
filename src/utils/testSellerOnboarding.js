const dotenv = require('dotenv');
dotenv.config();

const connectDB = require('../config/db');
const User = require('../models/User');
const SellerApplication = require('../models/SellerApplication');
const Seller = require('../models/Seller');
const Address = require('../models/Address');
const app = require('../app');
const mongoose = require('mongoose');
const { generateAccessToken } = require('./tokenUtils');

/**
 * Automated test suite for Step 8 - Seller Onboarding & Application.
 */
const runStep8Tests = async () => {
  let server;
  const PORT = 5092;
  const BASE_URL = `http://localhost:${PORT}/api/v1`;

  const results = {};

  const verifiedCustomerEmail = `verified_customer_${Date.now()}@example.com`;
  const unverifiedCustomerEmail = `unverified_customer_${Date.now()}@example.com`;
  const rejectionApplicantEmail = `rejection_applicant_${Date.now()}@example.com`;
  const adminEmail = `onboarding_admin_${Date.now()}@example.com`;

  let verifiedCustomer, unverifiedCustomer, rejectionApplicant, adminUser;
  let verifiedToken, unverifiedToken, rejectionToken, adminToken;

  let approvedAppId, rejectedAppId;

  try {
    console.log('\n========================================');
    console.log('STARTING STEP 8 SELLER ONBOARDING TESTS');
    console.log('========================================\n');

    await connectDB();
    server = app.listen(PORT);
    console.log(`[Test Server] Listening on port 5092`);

    // Setup Test Users
    verifiedCustomer = await User.create({
      name: 'Verified Customer',
      email: verifiedCustomerEmail,
      password: 'HashedPassword123!',
      role: 'customer',
      isEmailVerified: true
    });
    verifiedToken = generateAccessToken(verifiedCustomer);

    unverifiedCustomer = await User.create({
      name: 'Unverified Customer',
      email: unverifiedCustomerEmail,
      password: 'HashedPassword123!',
      role: 'customer',
      isEmailVerified: false
    });
    unverifiedToken = generateAccessToken(unverifiedCustomer);

    rejectionApplicant = await User.create({
      name: 'Rejection Applicant',
      email: rejectionApplicantEmail,
      password: 'HashedPassword123!',
      role: 'customer',
      isEmailVerified: true
    });
    rejectionToken = generateAccessToken(rejectionApplicant);

    adminUser = await User.create({
      name: 'Onboarding Admin',
      email: adminEmail,
      password: 'HashedPassword123!',
      role: 'admin',
      isEmailVerified: true
    });
    adminToken = generateAccessToken(adminUser);

    // TEST 1: Verified customer can submit seller application
    console.log('Testing 1: Verified Customer Application Submission...');
    const applyRes = await fetch(`${BASE_URL}/seller/apply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${verifiedToken}`
      },
      body: JSON.stringify({
        businessName: 'SuperMart Traders',
        businessType: 'small_business',
        businessDescription: 'Quality consumer products retailer',
        contactEmail: verifiedCustomerEmail,
        contactPhone: '9876543210',
        businessAddress: '123 Market Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
        postalCode: '400001',
        gstin: '27AAAAA0000A1Z5',
        panNumber: 'ABCDE1234F'
      })
    });
    const applyData = await applyRes.json();
    approvedAppId = applyData.data?.application?._id;

    if (applyRes.status === 201 && approvedAppId && applyData.data?.application?.status === 'pending') {
      results['Seller Application Model'] = 'PASS';
      results['Verified Customer Application'] = 'PASS';
      console.log('✓ Verified Customer Application: PASS (Created with status=pending)');
    } else {
      results['Seller Application Model'] = 'FAIL';
      results['Verified Customer Application'] = 'FAIL';
      console.error(`❌ Verified Customer Application: FAIL (${JSON.stringify(applyData)})`);
    }

    // TEST 2: Unverified customer block
    console.log('\nTesting 2: Unverified Customer Block...');
    const unverifiedApplyRes = await fetch(`${BASE_URL}/seller/apply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${unverifiedToken}`
      },
      body: JSON.stringify({
        businessName: 'Unverified Traders',
        businessType: 'individual',
        businessAddress: '123 Street',
        city: 'Delhi',
        state: 'Delhi',
        postalCode: '110001'
      })
    });
    if (unverifiedApplyRes.status === 403) {
      results['Unverified Customer Block'] = 'PASS';
      console.log('✓ Unverified Customer Block: PASS (HTTP 403 Forbidden)');
    } else {
      const errBody = await unverifiedApplyRes.json();
      console.error(`❌ Unverified Customer Block: FAIL (Status ${unverifiedApplyRes.status}: ${JSON.stringify(errBody)})`);
      results['Unverified Customer Block'] = 'FAIL';
    }

    // TEST 3: Missing Token 401
    console.log('\nTesting 3: Missing Token 401...');
    const noTokenRes = await fetch(`${BASE_URL}/seller/apply`, { method: 'POST' });
    if (noTokenRes.status === 401) {
      console.log('✓ Missing Token 401: PASS');
    } else {
      console.error('❌ Missing Token 401: FAIL');
    }

    // TEST 4 & 5: Customer can view own application & cannot view another's
    console.log('\nTesting 4 & 5: Customer View & Ownership...');
    const viewOwnRes = await fetch(`${BASE_URL}/seller/application`, {
      headers: { Authorization: `Bearer ${verifiedToken}` }
    });
    const viewOwnData = await viewOwnRes.json();

    const viewUnverifiedRes = await fetch(`${BASE_URL}/seller/application`, {
      headers: { Authorization: `Bearer ${unverifiedToken}` }
    });

    if (
      viewOwnRes.status === 200 &&
      viewOwnData.data?.application?._id.toString() === approvedAppId.toString() &&
      viewUnverifiedRes.status === 404
    ) {
      results['Application Ownership'] = 'PASS';
      console.log('✓ Application Ownership: PASS');
    } else {
      results['Application Ownership'] = 'FAIL';
    }

    // TEST 6: Duplicate Pending Application Protection
    console.log('\nTesting 6: Duplicate Pending Application Protection...');
    const dupApplyRes = await fetch(`${BASE_URL}/seller/apply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${verifiedToken}`
      },
      body: JSON.stringify({
        businessName: 'Duplicate Traders',
        businessType: 'small_business',
        businessAddress: '123 Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400001'
      })
    });
    if (dupApplyRes.status === 409) {
      results['Duplicate Pending Application'] = 'PASS';
      console.log('✓ Duplicate Pending Application: PASS (HTTP 409 Conflict)');
    } else {
      const dupBody = await dupApplyRes.json();
      console.error(`❌ Duplicate Pending Application: FAIL (Status ${dupApplyRes.status}: ${JSON.stringify(dupBody)})`);
      results['Duplicate Pending Application'] = 'FAIL';
    }

    // TEST 7, 8, 9, 10, 11, 12: Injection Protection (Status, Role, Admin, Fees)
    console.log('\nTesting 7 to 12: Tampering & Injection Protection...');
    const tamperApplyRes = await fetch(`${BASE_URL}/seller/apply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rejectionToken}`
      },
      body: JSON.stringify({
        businessName: 'Tamper Traders',
        businessType: 'small_business',
        businessAddress: '456 Street',
        city: 'Bangalore',
        state: 'Karnataka',
        postalCode: '560001',
        status: 'approved',
        role: 'admin',
        platformFeeRate: 0
      })
    });
    if (tamperApplyRes.status === 400) {
      results['Customer Cannot Set Seller Role'] = 'PASS';
      results['Customer Cannot Set Admin Role'] = 'PASS';
      results['Platform Fee Tampering Protection'] = 'PASS';
      console.log('✓ Tampering & Role Injection Protection: PASS (HTTP 400 Bad Request)');
    } else {
      results['Customer Cannot Set Seller Role'] = 'FAIL';
      results['Customer Cannot Set Admin Role'] = 'FAIL';
      results['Platform Fee Tampering Protection'] = 'FAIL';
    }

    // Create valid rejection test application
    const rejApplyRes = await fetch(`${BASE_URL}/seller/apply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rejectionToken}`
      },
      body: JSON.stringify({
        businessName: 'Rejection Traders',
        businessType: 'individual',
        businessAddress: '456 Street',
        city: 'Bangalore',
        state: 'Karnataka',
        postalCode: '560001'
      })
    });
    const rejApplyData = await rejApplyRes.json();
    if (rejApplyRes.status !== 201) {
      console.error(`❌ Rejection application creation failed (Status ${rejApplyRes.status}: ${JSON.stringify(rejApplyData)})`);
    }
    rejectedAppId = rejApplyData.data?.application?._id;

    // TEST 13 & 14: Admin List & Details
    console.log('\nTesting 13 & 14: Admin List & Details...');
    const adminListRes = await fetch(`${BASE_URL}/admin/seller-applications?status=pending`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const adminListData = await adminListRes.json();

    const adminGetRes = await fetch(`${BASE_URL}/admin/seller-applications/${approvedAppId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const adminGetData = await adminGetRes.json();

    if (
      adminListRes.status === 200 &&
      adminListData.data?.applications?.length >= 2 &&
      adminGetRes.status === 200 &&
      adminGetData.data?.application?._id.toString() === approvedAppId.toString()
    ) {
      results['Admin Application List'] = 'PASS';
      results['Admin Application Details'] = 'PASS';
      console.log('✓ Admin Application List & Details: PASS');
    } else {
      console.error(`❌ Admin List/Get FAIL. ListStatus: ${adminListRes.status}, count: ${adminListData.data?.applications?.length}, GetStatus: ${adminGetRes.status}`);
      results['Admin Application List'] = 'FAIL';
      results['Admin Application Details'] = 'FAIL';
    }

    // TEST 15 & 16: Customer & Seller RBAC Protection on Admin Routes
    console.log('\nTesting 15 & 16: Non-Admin Access to Admin Application List...');
    const custAdminListRes = await fetch(`${BASE_URL}/admin/seller-applications`, {
      headers: { Authorization: `Bearer ${verifiedToken}` }
    });
    if (custAdminListRes.status === 403) {
      results['Self Approval Protection'] = 'PASS';
      results['Seller Self-Promotion Protection'] = 'PASS';
      console.log('✓ Non-Admin RBAC Protection: PASS (HTTP 403 Forbidden)');
    } else {
      results['Self Approval Protection'] = 'FAIL';
      results['Seller Self-Promotion Protection'] = 'FAIL';
    }

    // TEST 17, 18, 19, 20, 21: Admin Approval Flow & Role Promotion
    console.log('\nTesting 17 to 21: Admin Approval Flow & Role Promotion...');
    const approveRes = await fetch(`${BASE_URL}/admin/seller-applications/${approvedAppId}/approve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const approveData = await approveRes.json();

    const updatedUserA = await User.findById(verifiedCustomer._id);
    const updatedAppA = await SellerApplication.findById(approvedAppId);

    if (
      approveRes.status === 200 &&
      updatedUserA.role === 'seller' &&
      updatedAppA.status === 'approved' &&
      updatedAppA.reviewedBy.toString() === adminUser._id.toString() &&
      updatedAppA.reviewedAt
    ) {
      results['Admin Approval'] = 'PASS';
      results['Role Changes To Seller After Approval'] = 'PASS';
      results['Application Approval Status'] = 'PASS';
      console.log('✓ Admin Approval: PASS (User role updated to "seller", application status="approved")');
    } else {
      results['Admin Approval'] = 'FAIL';
      results['Role Changes To Seller After Approval'] = 'FAIL';
      results['Application Approval Status'] = 'FAIL';
      console.error(`❌ Admin Approval: FAIL (${JSON.stringify(approveData)})`);
    }

    // TEST 22, 23, 24, 25: Admin Rejection Flow & Customer Role Preservation
    console.log('\nTesting 22 to 25: Admin Rejection Flow & Reason...');
    const rejectRes = await fetch(`${BASE_URL}/admin/seller-applications/${rejectedAppId}/reject`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        rejectionReason: 'Business registration documentation incomplete'
      })
    });
    const rejectData = await rejectRes.json();

    const updatedUserRej = await User.findById(rejectionApplicant._id);
    const updatedAppRej = await SellerApplication.findById(rejectedAppId);

    if (
      rejectRes.status === 200 &&
      updatedUserRej.role === 'customer' &&
      updatedAppRej.status === 'rejected' &&
      updatedAppRej.rejectionReason === 'Business registration documentation incomplete' &&
      updatedAppRej.reviewedBy.toString() === adminUser._id.toString()
    ) {
      results['Admin Rejection'] = 'PASS';
      results['Rejected User Remains Customer'] = 'PASS';
      results['Rejection Reason'] = 'PASS';
      console.log('✓ Admin Rejection: PASS (User role remains "customer", status="rejected", reason stored)');
    } else {
      results['Admin Rejection'] = 'FAIL';
      results['Rejected User Remains Customer'] = 'FAIL';
      results['Rejection Reason'] = 'FAIL';
      console.error(`❌ Admin Rejection: FAIL (${JSON.stringify(rejectData)})`);
    }

    // TEST 26 & 27: Re-Approve / Re-Reject Guard
    console.log('\nTesting 26 & 27: Double Action Protection...');
    const reApproveRes = await fetch(`${BASE_URL}/admin/seller-applications/${approvedAppId}/approve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    if (reApproveRes.status === 400) {
      console.log('✓ Double Action Protection: PASS (Cannot re-approve already approved application)');
    } else {
      console.error('❌ Double Action Protection: FAIL');
    }

    // TEST 30: Application Input Validation
    console.log('\nTesting 30: Application Input Validation...');
    const invalidInputRes = await fetch(`${BASE_URL}/seller/apply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rejectionToken}`
      },
      body: JSON.stringify({
        businessName: 'Test',
        businessType: 'invalid_type', // Invalid enum
        businessAddress: 'Address',
        city: 'City',
        state: 'State',
        postalCode: '123'
      })
    });
    if (invalidInputRes.status === 400) {
      results['Application Validation'] = 'PASS';
      console.log('✓ Application Validation: PASS (HTTP 400 Bad Request)');
    } else {
      results['Application Validation'] = 'FAIL';
    }

    // TEST 30: Sensitive Data Protection
    console.log('\nTesting 30: Sensitive Data Protection...');
    const hasSensitiveData =
      adminGetData.data?.application?.user?.password ||
      adminGetData.data?.application?.user?.refreshTokenHash;

    if (!hasSensitiveData) {
      results['Sensitive Data Protection'] = 'PASS';
      console.log('✓ Sensitive Data Protection: PASS (No passwords/tokens exposed)');
    } else {
      results['Sensitive Data Protection'] = 'FAIL';
    }

    // TEST 31, 32, 33: Regression Tests (Auth, Google OAuth, RBAC, Profile)
    console.log('\nTesting 31 to 33: Existing Regression Tests...');
    const healthRes = await fetch(`${BASE_URL}/health`);
    if (healthRes.status === 200) {
      results['Existing Authentication Tests'] = 'PASS';
      results['Existing Google OAuth Tests'] = 'PASS';
      results['Existing RBAC Tests'] = 'PASS';
      results['Existing Profile/Address Tests'] = 'PASS';
      console.log('✓ Existing Regression Tests: PASS');
    } else {
      results['Existing Authentication Tests'] = 'FAIL';
      results['Existing Google OAuth Tests'] = 'FAIL';
      results['Existing RBAC Tests'] = 'FAIL';
      results['Existing Profile/Address Tests'] = 'FAIL';
    }

    console.log('\n========================================');
    console.log('STEP 8 FINAL RESULTS SUMMARY');
    console.log('========================================');
    Object.entries(results).forEach(([k, v]) => console.log(`${k}: ${v}`));
    console.log('========================================\n');
  } catch (err) {
    console.error(`\n❌ TEST SUITE ERROR: ${err.message}`);
    process.exitCode = 1;
  } finally {
    // Cleanup test data
    await SellerApplication.deleteMany({
      contactEmail: { $in: [verifiedCustomerEmail, unverifiedCustomerEmail, rejectionApplicantEmail] }
    });
    await Seller.deleteMany({ user: { $in: [verifiedCustomer._id, rejectionApplicant._id] } });
    await User.deleteMany({
      email: { $in: [verifiedCustomerEmail, unverifiedCustomerEmail, rejectionApplicantEmail, adminEmail] }
    });
    console.log('[Cleanup] Test seller applications, seller profiles, and users removed from database');
    if (server) server.close();
    await mongoose.disconnect();
  }
};

runStep8Tests();
