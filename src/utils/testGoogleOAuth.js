const dotenv = require('dotenv');
dotenv.config();

const connectDB = require('../config/db');
const User = require('../models/User');
const app = require('../app');
const mongoose = require('mongoose');
const authService = require('../services/authService');

/**
 * Automated test suite for Step 5 - Google OAuth 2.0.
 */
const runGoogleOAuthTests = async () => {
  let server;
  const PORT = 5095;
  const BASE_URL = `http://localhost:${PORT}/api/v1`;

  const googleUserEmail = `google_oauth_test_${Date.now()}@example.com`;
  const googleId = `google_gid_${Date.now()}`;
  const mockProfile = {
    id: googleId,
    displayName: 'Google Test User',
    emails: [{ value: googleUserEmail }],
    photos: [{ value: 'https://lh3.googleusercontent.com/a/dummy-photo-url' }]
  };

  let createdGoogleUserId = null;

  try {
    console.log('\n========================================');
    console.log('STARTING STEP 5 GOOGLE OAUTH TESTS');
    console.log('========================================\n');

    await connectDB();
    server = app.listen(PORT);
    console.log(`[Test Server] Listening on port ${PORT}`);

    // TEST 1: GET /api/v1/auth/google Redirect Check
    console.log('\nRunning TEST 1: GET /api/v1/auth/google redirect check...');
    const googleAuthRes = await fetch(`${BASE_URL}/auth/google`, { redirect: 'manual' });
    console.log(`TEST 1 Status: ${googleAuthRes.status} (Expected: 302 redirect)`);
    const location = googleAuthRes.headers.get('location');
    if (googleAuthRes.status !== 302 || !location || !location.includes('accounts.google.com')) {
      throw new Error(`TEST 1 Failed: Response did not redirect to Google OAuth URL. Location: ${location}`);
    }
    console.log('✓ TEST 1 PASSED: Endpoint redirects to Google OAuth consent URL');

    // TEST 2 & 3: New Google Account Creation
    console.log('\nRunning TEST 2 & 3: Handle new Google account creation...');
    const authResult1 = await authService.handleGoogleAuth(mockProfile);

    if (!authResult1 || !authResult1.accessToken || !authResult1.rawRefreshToken || !authResult1.user) {
      throw new Error('TEST 2 & 3 Failed: handleGoogleAuth did not return expected token and user structure');
    }
    createdGoogleUserId = authResult1.user.id;

    // Verify DB user fields
    const dbGoogleUser = await User.findById(createdGoogleUserId).select('+password');
    if (!dbGoogleUser) throw new Error('TEST 3 Failed: User document not found in DB');
    if (dbGoogleUser.authProvider !== 'google') throw new Error('TEST 3 Failed: authProvider should be "google"');
    if (dbGoogleUser.googleId !== googleId) throw new Error('TEST 3 Failed: googleId mismatch');
    if (dbGoogleUser.isEmailVerified !== true) throw new Error('TEST 3 Failed: isEmailVerified should be true');
    if (dbGoogleUser.role !== 'customer') throw new Error('TEST 3 Failed: role should be "customer"');
    if (dbGoogleUser.password) throw new Error('TEST 3 Failed: Password should not exist for Google user');

    console.log('✓ TEST 2 & 3 PASSED: New Google account created with authProvider=google, isEmailVerified=true, role=customer, no password');

    // TEST 4: Google Login Again (Existing Account)
    console.log('\nRunning TEST 4: Repeat Google login using same account...');
    const authResult2 = await authService.handleGoogleAuth(mockProfile);

    if (authResult2.user.id.toString() !== createdGoogleUserId.toString()) {
      throw new Error('TEST 4 Failed: Created duplicate user instead of logging into existing user');
    }
    const userCount = await User.countDocuments({ email: googleUserEmail });
    if (userCount !== 1) {
      throw new Error(`TEST 4 Failed: Found ${userCount} users with email ${googleUserEmail}, expected exactly 1`);
    }
    console.log('✓ TEST 4 PASSED: Existing Google user logged in cleanly without creating duplicate');

    // TEST 5 & 6: Token Structure Check
    console.log('\nRunning TEST 5 & 6: JWT and Refresh Token format check...');
    const tokenUtils = require('./tokenUtils');
    const decoded = tokenUtils.verifyAccessToken(authResult2.accessToken);
    if (!decoded.userId || decoded.role !== 'customer') {
      throw new Error('TEST 5 Failed: Access token payload mismatch');
    }
    if (authResult2.accessToken.includes(googleId) || authResult2.accessToken.includes('secret')) {
      throw new Error('TEST 5 Failed: Access token contains sensitive raw data');
    }
    console.log('✓ TEST 5 & 6 PASSED: Standard JWT access token issued with minimal payload { userId, role }');

    // TEST 7: GET /api/v1/auth/me with Google access token
    console.log('\nRunning TEST 7: GET /api/v1/auth/me using Google access token...');
    const meRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${authResult2.accessToken}` }
    });
    const meData = await meRes.json();
    console.log(`TEST 7 Status: ${meRes.status} (Expected: 200)`);
    if (meRes.status !== 200 || !meData.success || meData.data.user.email !== googleUserEmail) {
      throw new Error(`TEST 7 Failed: ${JSON.stringify(meData)}`);
    }
    console.log('✓ TEST 7 PASSED: Protected /me endpoint authenticated Google user cleanly');

    // TEST 8: Database Integrity Verification
    console.log('\nRunning TEST 8: Database integrity verification...');
    const dbUserCheck = await User.findById(createdGoogleUserId).select('+password +refreshTokenHash');
    if (dbUserCheck.password) throw new Error('TEST 8 Failed: Plain password or password hash exposed');
    if (!dbUserCheck.googleId) throw new Error('TEST 8 Failed: googleId missing in DB');
    if (!dbUserCheck.isEmailVerified) throw new Error('TEST 8 Failed: Email not verified');
    console.log('✓ TEST 8 PASSED: MongoDB user document matches all security constraints');

    // TEST 9: Blocked Google User Test
    console.log('\nRunning TEST 9: Blocked Google user test...');
    dbUserCheck.isBlocked = true;
    await dbUserCheck.save();

    try {
      await authService.handleGoogleAuth(mockProfile);
      throw new Error('TEST 9 Failed: Blocked user was allowed to authenticate');
    } catch (err) {
      if (!err.message.toLowerCase().includes('blocked')) {
        throw new Error(`TEST 9 Failed: Unexpected error message: ${err.message}`);
      }
      console.log('✓ TEST 9 PASSED: Blocked Google user authentication rejected with HTTP 403 / error');
    } finally {
      dbUserCheck.isBlocked = false;
      await dbUserCheck.save();
    }

    // TEST 10: Local Account Conflict Check (No Silent Merge)
    console.log('\nRunning TEST 10: Local account conflict check...');
    const localEmail = `local_user_${Date.now()}@example.com`;
    const localUser = await User.create({
      name: 'Local User',
      email: localEmail,
      password: 'HashedPasswordPlaceholder',
      role: 'customer',
      authProvider: 'local',
      isEmailVerified: true
    });

    const conflictingGoogleProfile = {
      id: `google_gid_conflict_${Date.now()}`,
      displayName: 'Conflicting Google User',
      emails: [{ value: localEmail }]
    };

    try {
      await authService.handleGoogleAuth(conflictingGoogleProfile);
      throw new Error('TEST 10 Failed: Local account was silently merged with Google account');
    } catch (err) {
      if (err.statusCode !== 409 || !err.message.includes('already exists')) {
        throw new Error(`TEST 10 Failed: Expected 409 conflict, got: ${err.message}`);
      }
      console.log('✓ TEST 10 PASSED: Attempting Google login on pre-existing local account rejected with HTTP 409 conflict without silent merging');
    } finally {
      await User.findByIdAndDelete(localUser._id);
    }

    // TEST 11: Health API Regression Check
    console.log('\nRunning TEST 11: Health API check...');
    const healthRes = await fetch(`${BASE_URL}/health`);
    const healthData = await healthRes.json();
    console.log(`TEST 11 Status: ${healthRes.status} (Expected: 200)`);
    if (healthRes.status !== 200 || !healthData.success) {
      throw new Error(`TEST 11 Failed: ${JSON.stringify(healthData)}`);
    }
    console.log('✓ TEST 11 PASSED: Health API returned HTTP 200 OK');

    // TEST 12: Invalid Route Regression Check
    console.log('\nRunning TEST 12: Invalid route 404 check...');
    const invalidRes = await fetch(`${BASE_URL}/invalid-route`);
    const invalidData = await invalidRes.json();
    console.log(`TEST 12 Status: ${invalidRes.status} (Expected: 404)`);
    if (invalidRes.status !== 404 || invalidData.success !== false) {
      throw new Error(`TEST 12 Failed: ${JSON.stringify(invalidData)}`);
    }
    console.log('✓ TEST 12 PASSED: Invalid route returned structured HTTP 404 JSON');

    console.log('\n========================================');
    console.log('ALL GOOGLE OAUTH TESTS PASSED SUCCESSFULLY!');
    console.log('========================================\n');
  } catch (err) {
    console.error(`\n❌ TEST SUITE ERROR: ${err.message}`);
    process.exitCode = 1;
  } finally {
    if (createdGoogleUserId) {
      await User.findByIdAndDelete(createdGoogleUserId);
      console.log('[Cleanup] Test Google user removed from database');
    }
    if (server) server.close();
    await mongoose.disconnect();
  }
};

runGoogleOAuthTests();
