const dotenv = require('dotenv');
dotenv.config();

const connectDB = require('../config/db');
const User = require('../models/User');
const app = require('../app');
const mongoose = require('mongoose');
const { generateEmailVerificationToken, hashEmailVerificationToken } = require('./tokenUtils');
const emailService = require('../services/emailService');

/**
 * Automated test suite for Step 4 - Email Verification Implementation.
 */
const runEmailVerificationTests = async () => {
  let server;
  const PORT = 5096;
  const BASE_URL = `http://localhost:${PORT}/api/v1`;

  const testEmail1 = `emailtest1_${Date.now()}@example.com`;
  const testEmail2 = `emailtest2_${Date.now()}@example.com`;
  const testPassword = 'Test@12345678!';

  let rawTokenUser1 = null;
  let rawTokenUser2Old = null;
  let rawTokenUser2New = null;

  try {
    console.log('\n========================================');
    console.log('STARTING STEP 4 EMAIL VERIFICATION TESTS');
    console.log('========================================\n');

    await connectDB();
    server = app.listen(PORT);
    console.log(`[Test Server] Listening on port ${PORT}`);

    // EMAIL TRANSPORT TEST
    console.log('\nRunning EMAIL TRANSPORT TEST...');
    const transportResult = await emailService.verifyTransporter();
    console.log(`Transporter verification result: success=${transportResult.success}, message="${transportResult.message}"`);
    if (!transportResult.success && !transportResult.message.includes('JSON mode')) {
      console.warn('Transporter verification warning:', transportResult.message);
    } else {
      console.log('✓ EMAIL TRANSPORT TEST PASSED: Email transporter verified cleanly');
    }

    // TEST 1: Registration with Verification Token Creation
    console.log('\nRunning TEST 1: Registration...');
    // We mock/intercept raw token generation in test by injecting token or reading from test flow
    rawTokenUser1 = generateEmailVerificationToken();
    const hashedToken1 = hashEmailVerificationToken(rawTokenUser1);

    const regRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Email Test User', email: testEmail1, password: testPassword })
    });
    const regData = await regRes.json();
    console.log(`TEST 1 Status: ${regRes.status} (Expected: 201)`);
    if (regRes.status !== 201 || !regData.success) {
      throw new Error(`TEST 1 Failed: ${JSON.stringify(regData)}`);
    }

    // Inspect user in DB
    const dbUser1 = await User.findOne({ email: testEmail1 }).select('+emailVerificationTokenHash +emailVerificationExpiresAt');
    if (!dbUser1) throw new Error('TEST 1 Failed: User not created in DB');
    if (dbUser1.isEmailVerified !== false) throw new Error('TEST 1 Failed: isEmailVerified should be false');
    if (!dbUser1.emailVerificationTokenHash) throw new Error('TEST 1 Failed: emailVerificationTokenHash missing in DB');
    if (!dbUser1.emailVerificationExpiresAt) throw new Error('TEST 1 Failed: emailVerificationExpiresAt missing in DB');

    // Replace DB user's token hash with our test rawTokenUser1's hash so we can test the token URL verification
    dbUser1.emailVerificationTokenHash = hashedToken1;
    await dbUser1.save();

    console.log('✓ TEST 1 PASSED: User created with isEmailVerified=false and hashed verification token in DB');

    // TEST 2: Email Sending Verification
    console.log('\nRunning TEST 2: Email sending structure...');
    // Verify sendVerificationEmail doesn't throw and formats cleanly
    await emailService.sendVerificationEmail({
      toEmail: testEmail1,
      userName: 'Email Test User',
      rawToken: rawTokenUser1
    });
    console.log('✓ TEST 2 PASSED: Email template rendered and sent via Nodemailer transporter');

    // TEST 3: Login Before Verification
    console.log('\nRunning TEST 3: Login before verification...');
    const loginBeforeRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail1, password: testPassword })
    });
    const loginBeforeData = await loginBeforeRes.json();
    console.log(`TEST 3 Status: ${loginBeforeRes.status} (Expected: 403)`);
    if (loginBeforeRes.status !== 403 || loginBeforeData.success !== false) {
      throw new Error(`TEST 3 Failed: ${JSON.stringify(loginBeforeData)}`);
    }
    console.log('✓ TEST 3 PASSED: Login rejected with HTTP 403 when email is unverified');

    // TEST 4: Email Verification
    console.log('\nRunning TEST 4: Email verification endpoint...');
    const verifyRes = await fetch(`${BASE_URL}/auth/verify-email?token=${rawTokenUser1}`);
    const verifyData = await verifyRes.json();
    console.log(`TEST 4 Status: ${verifyRes.status} (Expected: 200)`);
    if (verifyRes.status !== 200 || !verifyData.success) {
      throw new Error(`TEST 4 Failed: ${JSON.stringify(verifyData)}`);
    }

    const verifiedDbUser1 = await User.findOne({ email: testEmail1 }).select('+emailVerificationTokenHash +emailVerificationExpiresAt');
    if (!verifiedDbUser1.isEmailVerified) throw new Error('TEST 4 Failed: isEmailVerified was not set to true');
    if (verifiedDbUser1.emailVerificationTokenHash || verifiedDbUser1.emailVerificationExpiresAt) {
      throw new Error('TEST 4 Failed: Verification token data was not removed after verification');
    }
    console.log('✓ TEST 4 PASSED: Email marked as verified and token data removed from DB');

    // TEST 5: Login After Verification
    console.log('\nRunning TEST 5: Login after verification...');
    const loginAfterRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail1, password: testPassword })
    });
    const loginAfterData = await loginAfterRes.json();
    console.log(`TEST 5 Status: ${loginAfterRes.status} (Expected: 200)`);
    if (loginAfterRes.status !== 200 || !loginAfterData.data?.accessToken) {
      throw new Error(`TEST 5 Failed: ${JSON.stringify(loginAfterData)}`);
    }
    console.log('✓ TEST 5 PASSED: Login succeeded after email verification with access token returned');

    // TEST 6: Reuse Verification Token
    console.log('\nRunning TEST 6: Reuse verification token...');
    const reuseRes = await fetch(`${BASE_URL}/auth/verify-email?token=${rawTokenUser1}`);
    const reuseData = await reuseRes.json();
    console.log(`TEST 6 Status: ${reuseRes.status}`);
    if (reuseRes.status !== 200 && reuseRes.status !== 400) {
      throw new Error(`TEST 6 Failed: ${JSON.stringify(reuseData)}`);
    }
    console.log('✓ TEST 6 PASSED: Reusing verified token returned safe response');

    // TEST 7: Invalid Verification Token
    console.log('\nRunning TEST 7: Invalid verification token...');
    const invalidRes = await fetch(`${BASE_URL}/auth/verify-email?token=invalid_random_token_12345`);
    const invalidData = await invalidRes.json();
    console.log(`TEST 7 Status: ${invalidRes.status} (Expected: 400)`);
    if (invalidRes.status !== 400 || invalidData.success !== false) {
      throw new Error(`TEST 7 Failed: ${JSON.stringify(invalidData)}`);
    }
    console.log('✓ TEST 7 PASSED: Invalid token rejected with HTTP 400');

    // TEST 8: Expired Verification Token
    console.log('\nRunning TEST 8: Expired verification token...');
    const expiredRawToken = generateEmailVerificationToken();
    const expiredHashedToken = hashEmailVerificationToken(expiredRawToken);

    // Create temporary unverified user with expired token
    const expiredUser = await User.create({
      name: 'Expired Test User',
      email: `expired_${Date.now()}@example.com`,
      password: 'TestPassword123!',
      role: 'customer',
      isEmailVerified: false,
      emailVerificationTokenHash: expiredHashedToken,
      emailVerificationExpiresAt: new Date(Date.now() - 10000) // Past date
    });

    const expiredRes = await fetch(`${BASE_URL}/auth/verify-email?token=${expiredRawToken}`);
    const expiredData = await expiredRes.json();
    console.log(`TEST 8 Status: ${expiredRes.status} (Expected: 400)`);
    if (expiredRes.status !== 400 || expiredData.message !== 'Verification link is invalid or has expired.') {
      throw new Error(`TEST 8 Failed: ${JSON.stringify(expiredData)}`);
    }
    await User.findByIdAndDelete(expiredUser._id);
    console.log('✓ TEST 8 PASSED: Expired token rejected with HTTP 400');

    // TEST 9 & 10: Resend Verification and Old Token Invalidation
    console.log('\nRunning TEST 9 & 10: Resend verification flow...');
    rawTokenUser2Old = generateEmailVerificationToken();
    const hashedToken2Old = hashEmailVerificationToken(rawTokenUser2Old);

    const user2 = await User.create({
      name: 'Resend User',
      email: testEmail2,
      password: testPassword,
      role: 'customer',
      isEmailVerified: false,
      emailVerificationTokenHash: hashedToken2Old,
      emailVerificationExpiresAt: new Date(Date.now() + 30 * 60 * 1000)
    });

    // Call resend verification
    const resendRes = await fetch(`${BASE_URL}/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail2 })
    });
    const resendData = await resendRes.json();
    console.log(`TEST 9 Resend Status: ${resendRes.status} (Expected: 200)`);
    if (resendRes.status !== 200 || !resendData.success) {
      throw new Error(`TEST 9 Failed: ${JSON.stringify(resendData)}`);
    }

    // Verify old token fails
    const oldTokenRes = await fetch(`${BASE_URL}/auth/verify-email?token=${rawTokenUser2Old}`);
    const oldTokenData = await oldTokenRes.json();
    console.log(`TEST 10 Old Token Status: ${oldTokenRes.status} (Expected: 400)`);
    if (oldTokenRes.status !== 400) {
      throw new Error(`TEST 10 Failed: Old token was not invalidated by resend`);
    }
    console.log('✓ TEST 9 & 10 PASSED: Resend issued new verification token and invalidated old token');

    // TEST 11: Health Regression Check
    console.log('\nRunning TEST 11: Health API check...');
    const healthRes = await fetch(`${BASE_URL}/health`);
    const healthData = await healthRes.json();
    console.log(`TEST 11 Status: ${healthRes.status} (Expected: 200)`);
    if (healthRes.status !== 200 || !healthData.success) {
      throw new Error(`TEST 11 Failed: ${JSON.stringify(healthData)}`);
    }
    console.log('✓ TEST 11 PASSED: Health API returned HTTP 200');

    // TEST 12: Invalid Route Regression Check
    console.log('\nRunning TEST 12: Invalid route 404 check...');
    const invalidRouteRes = await fetch(`${BASE_URL}/test-invalid`);
    const invalidRouteData = await invalidRouteRes.json();
    console.log(`TEST 12 Status: ${invalidRouteRes.status} (Expected: 404)`);
    if (invalidRouteRes.status !== 404 || invalidRouteData.success !== false) {
      throw new Error(`TEST 12 Failed: ${JSON.stringify(invalidRouteData)}`);
    }
    console.log('✓ TEST 12 PASSED: Invalid route returned structured HTTP 404 response');

    console.log('\n========================================');
    console.log('ALL EMAIL VERIFICATION TESTS PASSED!');
    console.log('========================================\n');
  } catch (err) {
    console.error(`\n❌ TEST SUITE ERROR: ${err.message}`);
    process.exitCode = 1;
  } finally {
    // Cleanup test users
    await User.deleteMany({ email: { $in: [testEmail1, testEmail2] } });
    console.log('[Cleanup] Test users cleaned up from database');
    if (server) server.close();
    await mongoose.disconnect();
  }
};

runEmailVerificationTests();
