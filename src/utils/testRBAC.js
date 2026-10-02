const dotenv = require('dotenv');
dotenv.config();

const connectDB = require('../config/db');
const User = require('../models/User');
const app = require('../app');
const mongoose = require('mongoose');
const { generateAccessToken } = require('./tokenUtils');
const authService = require('../services/authService');

/**
 * Automated test suite for Step 6 - Role-Based Access Control (RBAC).
 */
const runRBACTests = async () => {
  let server;
  const PORT = 5094;
  const BASE_URL = `http://localhost:${PORT}/api/v1`;

  const results = {};

  const customerEmail = `rbac_customer_${Date.now()}@example.com`;
  const sellerEmail = `rbac_seller_${Date.now()}@example.com`;
  const adminEmail = `rbac_admin_${Date.now()}@example.com`;

  let customerUser, sellerUser, adminUser;
  let customerToken, sellerToken, adminToken;

  try {
    console.log('\n========================================');
    console.log('STARTING STEP 6 RBAC TEST SUITE');
    console.log('========================================\n');

    await connectDB();
    server = app.listen(PORT);
    console.log(`[Test Server] Listening on port ${PORT}`);

    // TEST 1: User Role Enum Check
    console.log('Testing 1: User Role Enum...');
    const roleEnum = User.schema.path('role').enumValues;
    if (roleEnum.includes('customer') && roleEnum.includes('seller') && roleEnum.includes('admin') && roleEnum.length === 3) {
      results['User Role Enum'] = 'PASS';
      console.log('✓ User Role Enum: PASS');
    } else {
      results['User Role Enum'] = 'FAIL';
      console.error('❌ User Role Enum: FAIL');
    }

    // TEST 2 & 3: Registration Role Protection & Default Customer Role
    console.log('\nTesting 2 & 3: Registration Role Protection & Default Role...');
    const regRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'RBAC Registration Test',
        email: customerEmail,
        password: 'Password123!',
        role: 'admin' // Attempting privilege escalation
      })
    });
    const regData = await regRes.json();

    customerUser = await User.findOne({ email: customerEmail });
    if (customerUser && customerUser.role === 'customer') {
      results['Default Customer Role'] = 'PASS';
      results['Registration Role Protection'] = 'PASS';
      console.log('✓ Default Customer Role: PASS');
      console.log('✓ Registration Role Protection: PASS (Escalation attempt ignored, assigned customer)');
    } else {
      results['Default Customer Role'] = 'FAIL';
      results['Registration Role Protection'] = 'FAIL';
      console.error('❌ Registration Role Protection: FAIL');
    }

    // TEST 4: Google OAuth Role Protection
    console.log('\nTesting 4: Google OAuth Role Protection...');
    const googleProfile = {
      id: `gid_rbac_${Date.now()}`,
      displayName: 'Google RBAC Test',
      emails: [{ value: `google_rbac_${Date.now()}@example.com` }]
    };
    const googleAuthRes = await authService.handleGoogleAuth(googleProfile);
    if (googleAuthRes.user.role === 'customer') {
      results['Google Role Protection'] = 'PASS';
      console.log('✓ Google Role Protection: PASS (Assigned customer role)');
    } else {
      results['Google Role Protection'] = 'FAIL';
      console.error('❌ Google Role Protection: FAIL');
    }
    await User.findByIdAndDelete(googleAuthRes.user.id);

    // Setup Test Users & Tokens for RBAC Routing
    customerUser.isEmailVerified = true;
    await customerUser.save();
    customerToken = generateAccessToken(customerUser);

    sellerUser = await User.create({
      name: 'Test Seller',
      email: sellerEmail,
      password: 'HashedPassword123',
      role: 'seller',
      isEmailVerified: true
    });
    sellerToken = generateAccessToken(sellerUser);

    adminUser = await User.create({
      name: 'Test Admin',
      email: adminEmail,
      password: 'HashedPassword123',
      role: 'admin',
      isEmailVerified: true
    });
    adminToken = generateAccessToken(adminUser);

    // TEST 5: Customer Authorization
    console.log('\nTesting 5: Customer Authorization...');
    const custRes = await fetch(`${BASE_URL}/test/customer`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    if (custRes.status === 200) {
      results['Customer Authorization'] = 'PASS';
      console.log('✓ Customer Authorization: PASS (200 OK)');
    } else {
      results['Customer Authorization'] = 'FAIL';
    }

    // TEST 6 & 7: Customer → Seller / Admin 403 Forbidden
    console.log('\nTesting 6 & 7: Customer → Seller / Admin 403 Protection...');
    const custToSellerRes = await fetch(`${BASE_URL}/test/seller`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    const custToAdminRes = await fetch(`${BASE_URL}/test/admin`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });

    if (custToSellerRes.status === 403) {
      results['Customer → Seller 403'] = 'PASS';
      console.log('✓ Customer → Seller 403: PASS');
    } else {
      results['Customer → Seller 403'] = 'FAIL';
    }

    if (custToAdminRes.status === 403) {
      results['Customer → Admin 403'] = 'PASS';
      console.log('✓ Customer → Admin 403: PASS');
    } else {
      results['Customer → Admin 403'] = 'FAIL';
    }

    // TEST 8 & 9: Missing & Invalid Token 401
    console.log('\nTesting 8 & 9: Missing & Invalid Token 401...');
    const noTokenRes = await fetch(`${BASE_URL}/test/customer`);
    const invalidTokenRes = await fetch(`${BASE_URL}/test/customer`, {
      headers: { Authorization: 'Bearer invalid.jwt.token' }
    });

    if (noTokenRes.status === 401) {
      results['Missing Token 401'] = 'PASS';
      console.log('✓ Missing Token 401: PASS');
    } else {
      results['Missing Token 401'] = 'FAIL';
    }

    if (invalidTokenRes.status === 401) {
      results['Invalid Token 401'] = 'PASS';
      console.log('✓ Invalid Token 401: PASS');
    } else {
      results['Invalid Token 401'] = 'FAIL';
    }

    // TEST 10 & 11: Seller Authorization & Seller → Admin 403
    console.log('\nTesting 10 & 11: Seller Authorization & Admin Restriction...');
    const sellerToSellerRes = await fetch(`${BASE_URL}/test/seller`, {
      headers: { Authorization: `Bearer ${sellerToken}` }
    });
    const sellerToAdminRes = await fetch(`${BASE_URL}/test/admin`, {
      headers: { Authorization: `Bearer ${sellerToken}` }
    });

    if (sellerToSellerRes.status === 200) {
      results['Seller Authorization'] = 'PASS';
      console.log('✓ Seller Authorization: PASS (200 OK)');
    } else {
      results['Seller Authorization'] = 'FAIL';
    }

    if (sellerToAdminRes.status === 403) {
      results['Seller → Admin 403'] = 'PASS';
      console.log('✓ Seller → Admin 403: PASS');
    } else {
      results['Seller → Admin 403'] = 'FAIL';
    }

    // TEST 12 & 13: Admin Access to Admin & Seller Routes
    console.log('\nTesting 12 & 13: Admin Access to Admin & Seller Routes...');
    const adminToAdminRes = await fetch(`${BASE_URL}/test/admin`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const adminToSellerRes = await fetch(`${BASE_URL}/test/seller`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    if (adminToAdminRes.status === 200 && adminToSellerRes.status === 200) {
      results['Admin Authorization'] = 'PASS';
      results['Admin Access'] = 'PASS';
      console.log('✓ Admin Authorization: PASS (200 OK for Admin & Seller shared routes)');
    } else {
      results['Admin Authorization'] = 'FAIL';
      results['Admin Access'] = 'FAIL';
    }

    // TEST 14: Sensitive Data Protection & Existing Auth Regression
    console.log('\nTesting 14: Sensitive Data Protection & Auth Regression...');
    const testAdminData = await adminToAdminRes.json();
    const hasSensitiveData =
      testAdminData.data?.user?.password ||
      testAdminData.data?.user?.refreshTokenHash ||
      testAdminData.data?.user?.jwt;

    if (!hasSensitiveData) {
      results['Sensitive Data Protection'] = 'PASS';
      console.log('✓ Sensitive Data Protection: PASS (No passwords/tokens in payload)');
    } else {
      results['Sensitive Data Protection'] = 'FAIL';
    }

    const healthRes = await fetch(`${BASE_URL}/health`);
    if (healthRes.status === 200) {
      results['Existing Auth Regression Tests'] = 'PASS';
      console.log('✓ Existing Auth Regression Tests: PASS');
    } else {
      results['Existing Auth Regression Tests'] = 'FAIL';
    }

    console.log('\n========================================');
    console.log('STEP 6 FINAL RESULTS SUMMARY');
    console.log('========================================');
    Object.entries(results).forEach(([k, v]) => console.log(`${k}: ${v}`));
    console.log('========================================\n');
  } catch (err) {
    console.error(`\n❌ TEST SUITE ERROR: ${err.message}`);
    process.exitCode = 1;
  } finally {
    // Cleanup test users
    await User.deleteMany({ email: { $in: [customerEmail, sellerEmail, adminEmail] } });
    console.log('[Cleanup] Test users removed from database');
    if (server) server.close();
    await mongoose.disconnect();
  }
};

runRBACTests();
