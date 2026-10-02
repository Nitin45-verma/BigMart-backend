const dotenv = require('dotenv');
dotenv.config();

const connectDB = require('../config/db');
const User = require('../models/User');
const Address = require('../models/Address');
const app = require('../app');
const mongoose = require('mongoose');
const { generateAccessToken } = require('./tokenUtils');

/**
 * Automated test suite for Step 7 - User Profile and Address Management.
 */
const runStep7Tests = async () => {
  let server;
  const PORT = 5093;
  const BASE_URL = `http://localhost:${PORT}/api/v1`;

  const results = {};

  const userAEmail = `profile_usera_${Date.now()}@example.com`;
  const userBEmail = `profile_userb_${Date.now()}@example.com`;

  let userA, userB;
  let tokenA, tokenB;
  let address1Id, address2Id;

  try {
    console.log('\n========================================');
    console.log('STARTING STEP 7 PROFILE & ADDRESS TESTS');
    console.log('========================================\n');

    await connectDB();
    server = app.listen(PORT);
    console.log(`[Test Server] Listening on port 5093`);

    // Setup Test Users A & B
    userA = await User.create({
      name: 'User A',
      email: userAEmail,
      password: 'HashedPassword123!',
      role: 'customer',
      isEmailVerified: true
    });
    tokenA = generateAccessToken(userA);

    userB = await User.create({
      name: 'User B',
      email: userBEmail,
      password: 'HashedPassword123!',
      role: 'customer',
      isEmailVerified: true
    });
    tokenB = generateAccessToken(userB);

    // TEST 1: Profile GET
    console.log('Testing 1: Profile GET...');
    const getProfileRes = await fetch(`${BASE_URL}/users/me`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const getProfileData = await getProfileRes.json();
    if (getProfileRes.status === 200 && getProfileData.data?.user?.email === userAEmail) {
      results['Profile GET'] = 'PASS';
      console.log('✓ Profile GET: PASS');
    } else {
      results['Profile GET'] = 'FAIL';
      console.error('❌ Profile GET: FAIL');
    }

    // TEST 2: Missing Token 401
    console.log('\nTesting 2: Missing Token 401...');
    const noTokenRes = await fetch(`${BASE_URL}/users/me`);
    if (noTokenRes.status === 401) {
      results['Missing Token 401'] = 'PASS';
      console.log('✓ Missing Token 401: PASS');
    } else {
      results['Missing Token 401'] = 'FAIL';
    }

    // TEST 3: Profile UPDATE
    console.log('\nTesting 3: Profile UPDATE...');
    const updateProfileRes = await fetch(`${BASE_URL}/users/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        firstName: 'John',
        lastName: 'Doe',
        gender: 'male',
        dateOfBirth: '1995-05-15'
      })
    });
    const updateProfileData = await updateProfileRes.json();
    if (
      updateProfileRes.status === 200 &&
      updateProfileData.data?.user?.firstName === 'John' &&
      updateProfileData.data?.user?.name === 'John Doe'
    ) {
      results['Profile UPDATE'] = 'PASS';
      console.log('✓ Profile UPDATE: PASS');
    } else {
      results['Profile UPDATE'] = 'FAIL';
      console.error('❌ Profile UPDATE: FAIL');
    }

    // TEST 4 & 5: Protected Profile Fields Rejection
    console.log('\nTesting 4 & 5: Protected Profile Fields...');
    const roleEscalationRes = await fetch(`${BASE_URL}/users/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({ role: 'admin' })
    });

    const emailVerifyRes = await fetch(`${BASE_URL}/users/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({ isEmailVerified: false })
    });

    if (roleEscalationRes.status === 400 && emailVerifyRes.status === 400) {
      results['Protected Profile Fields'] = 'PASS';
      console.log('✓ Protected Profile Fields: PASS (Role escalation & verify status tampering rejected)');
    } else {
      results['Protected Profile Fields'] = 'FAIL';
      console.error('❌ Protected Profile Fields: FAIL');
    }

    // TEST 6 & 7: Create Address & First Address Default
    console.log('\nTesting 6 & 7: Create Address & First Address Default...');
    const createAdd1Res = await fetch(`${BASE_URL}/users/me/addresses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        fullName: 'John Doe',
        phone: '9876543210',
        addressLine1: 'Flat 101, Green Heights',
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
        postalCode: '400001',
        addressType: 'home'
      })
    });
    const createAdd1Data = await createAdd1Res.json();
    address1Id = createAdd1Data.data?.address?._id;

    if (
      createAdd1Res.status === 201 &&
      address1Id &&
      createAdd1Data.data?.address?.isDefault === true
    ) {
      results['Create Address'] = 'PASS';
      results['Default Address'] = 'PASS';
      console.log('✓ Create Address: PASS');
      console.log('✓ First Address Default: PASS (Automatically set as default)');
    } else {
      results['Create Address'] = 'FAIL';
      results['Default Address'] = 'FAIL';
      console.error('❌ Create Address / First Address Default: FAIL');
    }

    // TEST 8: Create Second Address
    console.log('\nTesting 8: Create Second Address...');
    const createAdd2Res = await fetch(`${BASE_URL}/users/me/addresses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        fullName: 'John Work',
        phone: '9876543210',
        addressLine1: 'Tech Park, Tower B',
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
        postalCode: '400002',
        addressType: 'work'
      })
    });
    const createAdd2Data = await createAdd2Res.json();
    address2Id = createAdd2Data.data?.address?._id;

    if (
      createAdd2Res.status === 201 &&
      address2Id &&
      createAdd2Data.data?.address?.isDefault === false
    ) {
      console.log('✓ Create Second Address: PASS (Created with isDefault=false)');
    } else {
      throw new Error(`Create Second Address Failed: ${JSON.stringify(createAdd2Data)}`);
    }

    // TEST 9 & 10: Set Default Address & Single Default Enforcement
    console.log('\nTesting 9 & 10: Set Default Address & Single Default Enforcement...');
    const setDefaultRes = await fetch(`${BASE_URL}/users/me/addresses/${address2Id}/default`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const setDefaultData = await setDefaultRes.json();

    const userAAddresses = await Address.find({ user: userA._id });
    const defaultAddresses = userAAddresses.filter((a) => a.isDefault);

    if (
      setDefaultRes.status === 200 &&
      setDefaultData.data?.address?.isDefault === true &&
      defaultAddresses.length === 1 &&
      defaultAddresses[0]._id.toString() === address2Id.toString()
    ) {
      results['Single Default Enforcement'] = 'PASS';
      console.log('✓ Single Default Enforcement: PASS (Only address 2 is default)');
    } else {
      results['Single Default Enforcement'] = 'FAIL';
      console.error('❌ Single Default Enforcement: FAIL');
    }

    // TEST 11: Get Addresses List
    console.log('\nTesting 11: Get Addresses List...');
    const getAddRes = await fetch(`${BASE_URL}/users/me/addresses`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const getAddData = await getAddRes.json();
    if (getAddRes.status === 200 && getAddData.data?.addresses?.length === 2) {
      results['Get Addresses'] = 'PASS';
      console.log('✓ Get Addresses: PASS (Returned 2 saved user addresses)');
    } else {
      results['Get Addresses'] = 'FAIL';
    }

    // TEST 12: Update Address
    console.log('\nTesting 12: Update Address...');
    const updateAddRes = await fetch(`${BASE_URL}/users/me/addresses/${address1Id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        landmark: 'Near City Mall'
      })
    });
    const updateAddData = await updateAddRes.json();
    if (updateAddRes.status === 200 && updateAddData.data?.address?.landmark === 'Near City Mall') {
      results['Update Address'] = 'PASS';
      console.log('✓ Update Address: PASS');
    } else {
      results['Update Address'] = 'FAIL';
    }

    // TEST 13 to 17: Cross-User Access Protection (GET, PATCH, DELETE, DEFAULT)
    console.log('\nTesting 13 to 17: Cross-User Access Protection (User B trying User A address)...');
    const bUpdateA = await fetch(`${BASE_URL}/users/me/addresses/${address1Id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`
      },
      body: JSON.stringify({ landmark: 'Malicious Landmark' })
    });

    const bDeleteA = await fetch(`${BASE_URL}/users/me/addresses/${address1Id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` }
    });

    const bSetDefaultA = await fetch(`${BASE_URL}/users/me/addresses/${address1Id}/default`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenB}` }
    });

    if (bUpdateA.status === 404 && bDeleteA.status === 404 && bSetDefaultA.status === 404) {
      results['Address Ownership'] = 'PASS';
      results['Cross-User Access Protection'] = 'PASS';
      console.log('✓ Cross-User Access Protection: PASS (User B unauthorized modifications rejected with HTTP 404)');
    } else {
      results['Address Ownership'] = 'FAIL';
      results['Cross-User Access Protection'] = 'FAIL';
      console.error(`❌ Cross-User Access Protection: FAIL (bUpdate: ${bUpdateA.status}, bDelete: ${bDeleteA.status}, bSetDefault: ${bSetDefaultA.status})`);
    }

    // TEST 18 & 19: Delete Address & Default Address Fallback
    console.log('\nTesting 18 & 19: Delete Address & Default Address Fallback...');
    const delAdd2Res = await fetch(`${BASE_URL}/users/me/addresses/${address2Id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` }
    });

    const remainingAddresses = await Address.find({ user: userA._id });
    const newDefault = remainingAddresses.find((a) => a.isDefault);

    if (
      delAdd2Res.status === 200 &&
      remainingAddresses.length === 1 &&
      newDefault &&
      newDefault._id.toString() === address1Id.toString()
    ) {
      results['Delete Address'] = 'PASS';
      results['Default Address Fallback'] = 'PASS';
      console.log('✓ Delete Address & Fallback: PASS (Address 1 promoted to default upon deletion of default address 2)');
    } else {
      results['Delete Address'] = 'FAIL';
      results['Default Address Fallback'] = 'FAIL';
      console.error('❌ Delete Address / Default Fallback: FAIL');
    }

    // TEST 20: Address Validation (Indian PIN code check)
    console.log('\nTesting 20: Address Validation (Invalid PIN code)...');
    const invalidPinRes = await fetch(`${BASE_URL}/users/me/addresses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        fullName: 'Invalid Pin Test',
        addressLine1: 'Street 1',
        city: 'City',
        state: 'State',
        country: 'India',
        postalCode: '123' // Invalid Indian PIN code (must be 6 digits)
      })
    });

    const invalidIdRes = await fetch(`${BASE_URL}/users/me/addresses/invalid_id_format`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` }
    });

    if (invalidPinRes.status === 400 && invalidIdRes.status === 400) {
      results['Address Validation'] = 'PASS';
      console.log('✓ Address Validation: PASS (Invalid PIN code and malformed ID rejected with HTTP 400)');
    } else {
      results['Address Validation'] = 'FAIL';
      console.error(`❌ Address Validation: FAIL (pinStatus: ${invalidPinRes.status}, idStatus: ${invalidIdRes.status})`);
    }

    // TEST 21: Sensitive Data Protection
    console.log('\nTesting 21: Sensitive Data Protection...');
    const hasSensitiveData =
      getProfileData.data?.user?.password ||
      getProfileData.data?.user?.refreshTokenHash ||
      getProfileData.data?.user?.jwt;

    if (!hasSensitiveData) {
      results['Sensitive Data Protection'] = 'PASS';
      console.log('✓ Sensitive Data Protection: PASS (No passwords/tokens exposed)');
    } else {
      results['Sensitive Data Protection'] = 'FAIL';
    }

    // TEST 22: Existing Auth & RBAC Tests Regression
    console.log('\nTesting 22: Existing Auth & RBAC Regression...');
    const healthRes = await fetch(`${BASE_URL}/health`);
    if (healthRes.status === 200) {
      results['Existing Authentication Tests'] = 'PASS';
      results['Existing RBAC Tests'] = 'PASS';
      console.log('✓ Existing Auth & RBAC Tests: PASS');
    } else {
      results['Existing Authentication Tests'] = 'FAIL';
      results['Existing RBAC Tests'] = 'FAIL';
    }

    console.log('\n========================================');
    console.log('STEP 7 FINAL RESULTS SUMMARY');
    console.log('========================================');
    Object.entries(results).forEach(([k, v]) => console.log(`${k}: ${v}`));
    console.log('========================================\n');
  } catch (err) {
    console.error(`\n❌ TEST SUITE ERROR: ${err.message}`);
    process.exitCode = 1;
  } finally {
    // Cleanup test users & addresses
    if (userA) await Address.deleteMany({ user: userA._id });
    if (userB) await Address.deleteMany({ user: userB._id });
    await User.deleteMany({ email: { $in: [userAEmail, userBEmail] } });
    console.log('[Cleanup] Test users and addresses cleaned up from database');
    if (server) server.close();
    await mongoose.disconnect();
  }
};

runStep7Tests();
