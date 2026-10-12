const dotenv = require('dotenv');
dotenv.config();

const connectDB = require('../config/db');
const User = require('../models/User');
const Seller = require('../models/Seller');
const Category = require('../models/Category');
const Product = require('../models/Product');
const Address = require('../models/Address');
const Cart = require('../models/Cart');
const Order = require('../models/Order');
const app = require('../app');
const mongoose = require('mongoose');
const { generateAccessToken } = require('./tokenUtils');

const runSellerLocationTests = async () => {
  let server;
  const PORT = 5098;
  const BASE_URL = `http://localhost:${PORT}/api/v1`;

  const results = {};
  const timestamp = Date.now();

  try {
    console.log('\n========================================');
    console.log('STARTING SELLER LOCATION & SHIPPING FIX TESTS');
    console.log('========================================\n');

    await connectDB();
    server = app.listen(PORT);
    console.log(`[Test Server] Listening on port ${PORT}`);

    // ==========================================
    // TEST 1: SARASWATI ELECTRONICS & HOME APPLIANCES
    // ==========================================
    console.log('\n--- 1. Testing Saraswati Electronics & Home Appliances ---');
    const saraswatiSeller = await Seller.findOne({ businessName: /Saraswati/i });
    if (!saraswatiSeller) {
      throw new Error('Saraswati Electronics seller record not found in database');
    }

    console.log(`Found Saraswati: ID=${saraswatiSeller._id}, lat=${saraswatiSeller.latitude}, lon=${saraswatiSeller.longitude}`);
    if (saraswatiSeller.latitude && saraswatiSeller.longitude) {
      results['Saraswati Saved Coordinates'] = 'PASS';
      console.log('✓ Saraswati coordinates present: PASS');
    } else {
      results['Saraswati Saved Coordinates'] = 'FAIL';
      console.error('❌ Saraswati coordinates missing');
    }

    // Find customer and Saraswati product
    const customerUser = await User.findById('6ac873080cd2c7d7d09a9608');
    const customerToken = generateAccessToken(customerUser);
    const customerAddress = await Address.findOne({ user: customerUser._id });
    const saraswatiProduct = await Product.findOne({ seller: saraswatiSeller._id, status: 'active' });

    // Set up cart with Saraswati product
    await Cart.findOneAndUpdate(
      { user: customerUser._id },
      { $set: { items: [{ product: saraswatiProduct._id, quantity: 1 }] } },
      { upsert: true, new: true }
    );

    // Call /shipping/quote
    const quoteRes = await fetch(`${BASE_URL}/shipping/quote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`
      },
      body: JSON.stringify({ addressId: customerAddress._id })
    });
    const quoteData = await quoteRes.json();

    if (
      quoteRes.status === 200 &&
      quoteData.success &&
      quoteData.data?.shipping?.length === 1 &&
      quoteData.data.shipping[0].sellerId.toString() === saraswatiSeller._id.toString() &&
      quoteData.data.totalDeliveryFee === 130
    ) {
      results['Saraswati Shipping Quote Calculation'] = 'PASS';
      console.log(`✓ Saraswati Shipping Quote: PASS (Distance: ${quoteData.data.shipping[0].distanceKm} km, Fee: ₹${quoteData.data.totalDeliveryFee})`);
    } else {
      results['Saraswati Shipping Quote Calculation'] = 'FAIL';
      console.error(`❌ Saraswati Shipping Quote: FAIL (${JSON.stringify(quoteData)})`);
    }

    // ==========================================
    // TEST 2: ANOTHER SELLER (NK IT SOLUTION) & MULTI-VENDOR
    // ==========================================
    console.log('\n--- 2. Testing Another Seller (Nk It Solution) ---');
    const nkSeller = await Seller.findOne({ businessName: /Nk It Solution/i });
    if (!nkSeller) {
      throw new Error('Nk It Solution seller record not found in database');
    }

    const nkUser = await User.findById(nkSeller.user);
    const nkToken = generateAccessToken(nkUser);

    // Update Nk It Solution via PATCH /seller/dashboard/profile API
    const updateNkRes = await fetch(`${BASE_URL}/seller/dashboard/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${nkToken}`
      },
      body: JSON.stringify({
        businessAddress: {
          addressLine1: 'Kishanpura At Khatipura Kapurawala Muhana',
          city: 'Jaipur',
          state: 'Rajasthan',
          postalCode: '302029',
          country: 'India',
          latitude: 26.793319,
          longitude: 75.733611
        },
        latitude: 26.793319,
        longitude: 75.733611
      })
    });
    const updateNkData = await updateNkRes.json();

    if (updateNkRes.status === 200 && updateNkData.data?.latitude === 26.793319) {
      results['Another Seller Profile Location Update API'] = 'PASS';
      console.log('✓ Another Seller (Nk It Solution) Location Updated via API: PASS');
    } else {
      results['Another Seller Profile Location Update API'] = 'FAIL';
      console.error(`❌ Another Seller Location Update: FAIL (${JSON.stringify(updateNkData)})`);
    }

    // Ensure Nk It Solution has a product
    let nkCategory = await Category.findOne({ status: 'active' });
    let nkProduct = await Product.findOne({ seller: nkSeller._id });
    if (!nkProduct) {
      nkProduct = await Product.create({
        name: 'USB-C Fast Charging Cable',
        slug: `usbc-fast-charging-cable-${timestamp}`,
        sku: `NK-CABLE-${timestamp}`,
        description: 'Durable fast charging cable',
        price: 299,
        category: nkCategory._id,
        seller: nkSeller._id,
        stock: 50,
        status: 'active',
        isPublished: true
      });
    }

    // Set up multi-vendor cart with Saraswati & Nk It Solution
    await Cart.findOneAndUpdate(
      { user: customerUser._id },
      {
        $set: {
          items: [
            { product: saraswatiProduct._id, quantity: 1 },
            { product: nkProduct._id, quantity: 1 }
          ]
        }
      },
      { upsert: true, new: true }
    );

    const multiQuoteRes = await fetch(`${BASE_URL}/shipping/quote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`
      },
      body: JSON.stringify({ addressId: customerAddress._id })
    });
    const multiQuoteData = await multiQuoteRes.json();

    const saraswatiItem = multiQuoteData.data?.shipping?.find(s => s.sellerId.toString() === saraswatiSeller._id.toString());
    const nkItem = multiQuoteData.data?.shipping?.find(s => s.sellerId.toString() === nkSeller._id.toString());

    if (
      multiQuoteRes.status === 200 &&
      multiQuoteData.data?.shipping?.length === 2 &&
      saraswatiItem?.deliveryFee === 130 &&
      nkItem?.deliveryFee === 60 &&
      multiQuoteData.data?.totalDeliveryFee === 190
    ) {
      results['Multi-Vendor Shipping Quote (Saraswati + Another Seller)'] = 'PASS';
      console.log(`✓ Multi-Vendor Shipping Quote: PASS (Saraswati: ₹130, Nk: ₹60, Total: ₹190)`);
    } else {
      results['Multi-Vendor Shipping Quote (Saraswati + Another Seller)'] = 'FAIL';
      console.error(`❌ Multi-Vendor Quote: FAIL (${JSON.stringify(multiQuoteData)})`);
    }

    // ==========================================
    // TEST 3: SELLER WITHOUT COORDINATES (GUARD ENFORCEMENT)
    // ==========================================
    console.log('\n--- 3. Testing Missing Seller Coordinates Guard ---');
    const noCoordsUser = await User.create({
      name: 'No Coords Seller Test',
      email: `nocoords_${timestamp}@example.com`,
      password: 'HashedPassword123!',
      role: 'seller',
      isEmailVerified: true
    });
    const noCoordsSeller = await Seller.create({
      user: noCoordsUser._id,
      businessName: 'Unmapped Store',
      businessType: 'small_business',
      verificationStatus: 'approved'
      // No coordinates
    });
    const noCoordsProduct = await Product.create({
      name: 'Unmapped Item',
      slug: `unmapped-item-${timestamp}`,
      sku: `UNMAP-${timestamp}`,
      description: 'Item from seller without coords',
      price: 500,
      category: nkCategory._id,
      seller: noCoordsSeller._id,
      stock: 10,
      status: 'active',
      isPublished: true
    });

    // Cart with unmapped seller
    await Cart.findOneAndUpdate(
      { user: customerUser._id },
      { $set: { items: [{ product: noCoordsProduct._id, quantity: 1 }] } }
    );

    const noCoordsQuoteRes = await fetch(`${BASE_URL}/shipping/quote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`
      },
      body: JSON.stringify({ addressId: customerAddress._id })
    });
    const noCoordsQuoteData = await noCoordsQuoteRes.json();

    if (
      noCoordsQuoteRes.status === 400 &&
      noCoordsQuoteData.message.includes('Unmapped Store') &&
      noCoordsQuoteData.message.includes('location coordinates are unavailable')
    ) {
      results['Missing Seller Coordinates Guard Message'] = 'PASS';
      console.log('✓ Missing Coordinates Guard Message: PASS (HTTP 400 with actionable seller name)');
    } else {
      results['Missing Seller Coordinates Guard Message'] = 'FAIL';
      console.error(`❌ Missing Coordinates Guard: FAIL (${JSON.stringify(noCoordsQuoteData)})`);
    }

    // Checkout creation must also fail
    const blockedCheckoutRes = await fetch(`${BASE_URL}/orders/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`
      },
      body: JSON.stringify({ addressId: customerAddress._id })
    });
    if (blockedCheckoutRes.status === 400) {
      results['Blocked Checkout When Coordinates Missing'] = 'PASS';
      console.log('✓ Blocked Checkout Order Creation: PASS (HTTP 400)');
    } else {
      results['Blocked Checkout When Coordinates Missing'] = 'FAIL';
    }

    // ==========================================
    // TEST 4: PROFILE VALIDATION & SECURITY
    // ==========================================
    console.log('\n--- 4. Testing Profile Validation & Security ---');
    // Attempt invalid latitude (>90)
    const badLatRes = await fetch(`${BASE_URL}/seller/dashboard/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${nkToken}`
      },
      body: JSON.stringify({ latitude: 120, longitude: 75 })
    });
    if (badLatRes.status === 400) {
      results['Invalid Coordinate Bounds Rejection'] = 'PASS';
      console.log('✓ Invalid Coordinate Bounds Rejection: PASS (HTTP 400)');
    } else {
      results['Invalid Coordinate Bounds Rejection'] = 'FAIL';
    }

    // Customer forbidden from seller profile
    const customerForbiddenRes = await fetch(`${BASE_URL}/seller/dashboard/profile`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`
      }
    });
    if (customerForbiddenRes.status === 403) {
      results['Customer RBAC Block on Seller Profile'] = 'PASS';
      console.log('✓ Customer Access Blocked on Seller Profile: PASS (HTTP 403)');
    } else {
      results['Customer RBAC Block on Seller Profile'] = 'FAIL';
    }

    // ==========================================
    // CLEANUP TEMPORARY TEST DATA
    // ==========================================
    await Product.deleteMany({ _id: { $in: [noCoordsProduct._id] } });
    await Seller.deleteOne({ _id: noCoordsSeller._id });
    await User.deleteOne({ _id: noCoordsUser._id });

    // Restore customer cart to Saraswati product
    await Cart.findOneAndUpdate(
      { user: customerUser._id },
      { $set: { items: [{ product: saraswatiProduct._id, quantity: 1 }] } }
    );

    console.log('\n========================================');
    console.log('FINAL RESULTS SUMMARY');
    console.log('========================================');
    let allPassed = true;
    for (const [testName, status] of Object.entries(results)) {
      console.log(`${testName}: ${status}`);
      if (status !== 'PASS') allPassed = false;
    }
    console.log('========================================\n');

    if (server) server.close();
    process.exit(allPassed ? 0 : 1);

  } catch (err) {
    console.error('Test execution failed:', err);
    if (server) server.close();
    process.exit(1);
  }
};

runSellerLocationTests();
