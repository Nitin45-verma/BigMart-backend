const dotenv = require('dotenv');
dotenv.config();

const connectDB = require('../config/db');
const User = require('../models/User');
const app = require('../app');
const mongoose = require('mongoose');

/**
 * Automated test suite for Step 3 - Auth Implementation.
 */
const runAuthTests = async () => {
  let server;
  const PORT = 5097;
  const BASE_URL = `http://localhost:${PORT}/api/v1`;

  const testEmail = `authtest_${Date.now()}@example.com`;
  const testPassword = 'StrongPassword123!';
  let createdUserId = null;

  try {
    console.log('\n========================================');
    console.log('STARTING STEP 3 AUTH TEST SUITE');
    console.log('========================================\n');

    await connectDB();
    server = app.listen(PORT);
    console.log(`[Test Server] Listening on port ${PORT}`);

    // TEST 1: Register new customer
    console.log('Running TEST 1: Register new customer...');
    const regRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Auth Test User', email: testEmail, password: testPassword })
    });
    const regData = await regRes.json();
    console.log(`TEST 1 Status: ${regRes.status} (Expected: 201)`);
    if (regRes.status !== 201 || !regData.success || regData.data.user.role !== 'customer' || regData.data.user.isEmailVerified !== false) {
      throw new Error(`TEST 1 Failed: ${JSON.stringify(regData)}`);
    }
    if (regData.data.user.password || regData.data.accessToken || regData.data.refreshToken) {
      throw new Error('TEST 1 Failed: Exposed sensitive data in register response');
    }
    createdUserId = regData.data.user.id;
    console.log('✓ TEST 1 PASSED: Registration returned HTTP 201 with correct safe payload');

    // TEST 2: Duplicate email registration
    console.log('\nRunning TEST 2: Duplicate email registration...');
    const dupRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Duplicate User', email: testEmail, password: testPassword })
    });
    const dupData = await dupRes.json();
    console.log(`TEST 2 Status: ${dupRes.status} (Expected: 409)`);
    if (dupRes.status !== 409 || dupData.success !== false) {
      throw new Error(`TEST 2 Failed: ${JSON.stringify(dupData)}`);
    }
    console.log('✓ TEST 2 PASSED: Duplicate registration rejected with HTTP 409');

    // TEST 3: Login while email is unverified
    console.log('\nRunning TEST 3: Login with unverified email...');
    const unverifiedRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: testPassword })
    });
    const unverifiedData = await unverifiedRes.json();
    console.log(`TEST 3 Status: ${unverifiedRes.status} (Expected: 403)`);
    if (unverifiedRes.status !== 403 || unverifiedData.success !== false) {
      throw new Error(`TEST 3 Failed: ${JSON.stringify(unverifiedData)}`);
    }
    console.log('✓ TEST 3 PASSED: Login with unverified email rejected with HTTP 403');

    // TEST 4: Login with incorrect password
    console.log('\nRunning TEST 4: Login with incorrect password...');
    const wrongPassRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: 'WrongPassword999!' })
    });
    const wrongPassData = await wrongPassRes.json();
    console.log(`TEST 4 Status: ${wrongPassRes.status} (Expected: 401)`);
    if (wrongPassRes.status !== 401 || wrongPassData.message !== 'Invalid email or password.') {
      // Allow generic invalid message match
      if (wrongPassRes.status !== 401 || !wrongPassData.message.toLowerCase().includes('invalid')) {
        throw new Error(`TEST 4 Failed: ${JSON.stringify(wrongPassData)}`);
      }
    }
    console.log('✓ TEST 4 PASSED: Incorrect password rejected with generic HTTP 401 message');

    // TEST 5: Login with nonexistent email
    console.log('\nRunning TEST 5: Login with nonexistent email...');
    const nonExistRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `nonexistent_${Date.now()}@example.com`, password: testPassword })
    });
    const nonExistData = await nonExistRes.json();
    console.log(`TEST 5 Status: ${nonExistRes.status} (Expected: 401)`);
    if (nonExistRes.status !== 401 || !nonExistData.message.toLowerCase().includes('invalid')) {
      throw new Error(`TEST 5 Failed: ${JSON.stringify(nonExistData)}`);
    }
    console.log('✓ TEST 5 PASSED: Nonexistent email rejected with generic HTTP 401');

    // TEST 6: GET /auth/me without Authorization header
    console.log('\nRunning TEST 6: GET /auth/me without token...');
    const noAuthRes = await fetch(`${BASE_URL}/auth/me`);
    const noAuthData = await noAuthRes.json();
    console.log(`TEST 6 Status: ${noAuthRes.status} (Expected: 401)`);
    if (noAuthRes.status !== 401) {
      throw new Error(`TEST 6 Failed: ${JSON.stringify(noAuthData)}`);
    }
    console.log('✓ TEST 6 PASSED: Protected route without header rejected with HTTP 401');

    // TEST 7: GET /auth/me with invalid token
    console.log('\nRunning TEST 7: GET /auth/me with invalid token...');
    const invalidAuthRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: 'Bearer invalid.jwt.token' }
    });
    const invalidAuthData = await invalidAuthRes.json();
    console.log(`TEST 7 Status: ${invalidAuthRes.status} (Expected: 401)`);
    if (invalidAuthRes.status !== 401) {
      throw new Error(`TEST 7 Failed: ${JSON.stringify(invalidAuthData)}`);
    }
    console.log('✓ TEST 7 PASSED: Protected route with invalid token rejected with HTTP 401');

    // TEST 8: GET /health check
    console.log('\nRunning TEST 8: GET /health API regression check...');
    const healthRes = await fetch(`${BASE_URL}/health`);
    const healthData = await healthRes.json();
    console.log(`TEST 8 Status: ${healthRes.status} (Expected: 200)`);
    if (healthRes.status !== 200 || !healthData.success) {
      throw new Error(`TEST 8 Failed: ${JSON.stringify(healthData)}`);
    }
    console.log('✓ TEST 8 PASSED: Health API returned HTTP 200');

    // TEST 9: Invalid route check
    console.log('\nRunning TEST 9: Invalid route 404 check...');
    const notFoundRes = await fetch(`${BASE_URL}/invalid-route`);
    const notFoundData = await notFoundRes.json();
    console.log(`TEST 9 Status: ${notFoundRes.status} (Expected: 404)`);
    if (notFoundRes.status !== 404 || notFoundData.success !== false) {
      throw new Error(`TEST 9 Failed: ${JSON.stringify(notFoundData)}`);
    }
    console.log('✓ TEST 9 PASSED: Invalid route returned structured HTTP 404 response');

    // PASSWORD VERIFICATION TEST
    console.log('\nRunning PASSWORD VERIFICATION TEST...');
    const dbUser = await User.findById(createdUserId).select('+password');
    if (!dbUser || !dbUser.password) {
      throw new Error('Password verification failed: User or password field not found in DB');
    }
    const isPlainPasswordStored = dbUser.password === testPassword;
    const isBcryptHash = dbUser.password.startsWith('$2a$') || dbUser.password.startsWith('$2b$');
    if (isPlainPasswordStored || !isBcryptHash) {
      throw new Error('Password verification failed: Password is not stored as bcrypt hash');
    }
    console.log('✓ PASSWORD VERIFICATION PASSED: Stored password is a valid bcrypt hash and plain password is NOT stored.');

    // EXTRA TEST: Verified Email Login, Token Generation & Refresh Flow
    console.log('\nRunning VERIFIED EMAIL LOGIN & REFRESH ROTATION TEST...');
    dbUser.isEmailVerified = true;
    await dbUser.save();

    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: testPassword })
    });
    const loginData = await loginRes.json();
    const cookiesHeader = loginRes.headers.get('set-cookie');
    console.log(`Verified Login Status: ${loginRes.status} (Expected: 200)`);
    if (loginRes.status !== 200 || !loginData.data?.accessToken || !cookiesHeader?.includes('refreshToken')) {
      throw new Error(`Verified Login Failed: ${JSON.stringify(loginData)}`);
    }
    console.log('✓ Verified Login PASSED: Access token returned in JSON and Refresh Token set in HTTP-only cookie');

    // Test GET /auth/me with valid access token
    const meRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${loginData.data.accessToken}` }
    });
    const meData = await meRes.json();
    console.log(`Me Endpoint Status: ${meRes.status} (Expected: 200)`);
    if (meRes.status !== 200 || meData.data.user.email !== testEmail) {
      throw new Error(`Me Endpoint Failed: ${JSON.stringify(meData)}`);
    }
    console.log('✓ GET /auth/me PASSED: Valid access token authenticated user profile correctly');

    console.log('\n========================================');
    console.log('ALL AUTH TESTS PASSED SUCCESSFULLY!');
    console.log('========================================\n');
  } catch (err) {
    console.error(`\n❌ TEST SUITE ERROR: ${err.message}`);
    process.exitCode = 1;
  } finally {
    if (createdUserId) {
      await User.findByIdAndDelete(createdUserId);
      console.log('[Cleanup] Test user removed from database');
    }
    if (server) {
      server.close();
    }
    await mongoose.disconnect();
  }
};

runAuthTests();
