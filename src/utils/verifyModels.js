const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load environment variables
dotenv.config();

const connectDB = require('../config/db');
const User = require('../models/User');
const Seller = require('../models/Seller');
const SellerPlan = require('../models/SellerPlan');

/**
 * Safe development-only schema verification script.
 * Validates model schemas, paths, enum values, references, and indexes
 * without inserting documents into the database.
 */
const verifyModels = async () => {
  console.log('[Verification] Starting schema verification...');

  try {
    // 1. Connect to MongoDB using process.env.MONGO_URI
    await connectDB();
    console.log('[Verification] Connected to MongoDB');

    // 2. Verify Models can be loaded
    if (!User || !Seller || !SellerPlan) {
      throw new Error('One or more models failed to load');
    }
    console.log('[Verification] All models (User, Seller, SellerPlan) loaded successfully');

    // 3. Verify Required Schema Paths
    const requiredUserPaths = ['name', 'email', 'role', 'authProvider', 'password'];
    for (const pathName of requiredUserPaths) {
      if (!User.schema.path(pathName)) {
        throw new Error(`User schema path missing: ${pathName}`);
      }
    }

    const requiredSellerPaths = ['user', 'businessName', 'verificationStatus', 'sellerPlan'];
    for (const pathName of requiredSellerPaths) {
      if (!Seller.schema.path(pathName)) {
        throw new Error(`Seller schema path missing: ${pathName}`);
      }
    }

    const requiredPlanPaths = ['name', 'slug', 'platformFeeRate', 'commissionRate', 'isActive'];
    for (const pathName of requiredPlanPaths) {
      if (!SellerPlan.schema.path(pathName)) {
        throw new Error(`SellerPlan schema path missing: ${pathName}`);
      }
    }
    console.log('[Verification] Schema paths verified successfully');

    // 4. Verify Enum Values
    const userRoleEnum = User.schema.path('role').enumValues;
    if (!userRoleEnum.includes('customer') || !userRoleEnum.includes('seller') || !userRoleEnum.includes('admin')) {
      throw new Error('User role enum values mismatch');
    }

    const verificationEnum = Seller.schema.path('verificationStatus').enumValues;
    if (!verificationEnum.includes('pending') || !verificationEnum.includes('approved')) {
      throw new Error('Seller verificationStatus enum values mismatch');
    }
    console.log('[Verification] Enum values verified successfully');

    // 5. Verify Model References
    const sellerUserRef = Seller.schema.path('user').options.ref;
    if (sellerUserRef !== 'User') {
      throw new Error(`Seller.user ref expected 'User', found '${sellerUserRef}'`);
    }

    const sellerPlanRef = Seller.schema.path('sellerPlan').options.ref;
    if (sellerPlanRef !== 'SellerPlan') {
      throw new Error(`Seller.sellerPlan ref expected 'SellerPlan', found '${sellerPlanRef}'`);
    }
    console.log('[Verification] Model relationships and references verified successfully');

    // 6. Verify Index Synchronization (Creating indexes on DB schema)
    await User.syncIndexes();
    await Seller.syncIndexes();
    await SellerPlan.syncIndexes();
    console.log('[Verification] Database indexes created/synchronized successfully');

    console.log('[Verification] ALL MODEL VERIFICATIONS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error(`[Verification Failed] ${error.message}`);
    process.exitCode = 1;
  } finally {
    // 8. Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('[Verification] Disconnected cleanly from MongoDB');
  }
};

// Execute verification if called directly
if (require.main === module) {
  verifyModels();
}

module.exports = verifyModels;
