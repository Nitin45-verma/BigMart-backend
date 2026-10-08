const axios = require('axios');
const mongoose = require('mongoose');

const BASE_URL = 'http://localhost:5000/api/v1';
require('dotenv').config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    // Create user in DB to skip email verification limit
    const User = require('./src/models/User');
    const SellerApplication = require('./src/models/SellerApplication');
    const email = `sellerapptest${Date.now()}@example.com`;
    const user = await User.create({
      name: 'Seller App Test',
      email: email,
      password: 'Password123!',
      isEmailVerified: true
    });
    
    // Login to get token
    const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
      email,
      password: 'Password123!'
    });
    const token = loginRes.data.data.accessToken;

    console.log('Submitting seller application...');
    const payload = {
      businessName: 'My Awesome Store',
      businessType: 'large_business',
      gstin: '234720374981237',
      panNumber: 'ABCDE1234F',
      contactPhone: '9166680296',
      businessAddress: 'Kishanpura At Khatipura',
      city: 'Jaipur',
      state: 'Rajasthan',
      postalCode: '302021',
      businessDescription: 'Selling items online'
    };
    
    try {
      const applyRes = await axios.post(`${BASE_URL}/seller/apply`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('API Submission: PASS, HTTP Status:', applyRes.status);
    } catch(e) {
      console.error('API Submission FAILED:', e.response?.data);
      throw e;
    }

    // Verify persistence
    const app = await SellerApplication.findOne({ user: user._id });
    if (app && app.businessType === 'large_business' && app.status === 'pending') {
      console.log('Persistence: PASS');
    }

    // Verify User Role remains customer
    const userCheck = await User.findById(user._id);
    if (userCheck.role === 'customer') {
      console.log('User role remains customer: PASS');
    }

    // Duplicate application
    try {
      await axios.post(`${BASE_URL}/seller/apply`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Duplicate application allowed: FAIL');
    } catch(e) {
      if (e.response && e.response.status === 409) {
        console.log('Duplicate application blocked: PASS');
      } else {
        console.log('Duplicate application error:', e.response?.data);
      }
    }

    // Validation tests
    const badPayload = { ...payload, city: '' };
    try {
      await axios.post(`${BASE_URL}/seller/apply`, badPayload, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch(e) {
      if (e.response && e.response.status === 400) {
        console.log('Missing city validation: PASS');
      }
    }

    // Cleanup
    await SellerApplication.deleteOne({ _id: app._id });
    await User.deleteOne({ _id: user._id });

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
run();
