require('dotenv').config();
const connectDB = require('../src/config/db');
const User = require('../src/models/User');
const SellerApplication = require('../src/models/SellerApplication');
const Seller = require('../src/models/Seller');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const setup = async () => {
  try {
    await connectDB();
    console.log('Connected to DB');

    const hashedPassword = await bcrypt.hash('Password123!', 12);

    // Create Admin
    let admin = await User.findOne({ email: 'admin@example.com' });
    if (!admin) {
      admin = await User.create({
        name: 'Admin User',
        email: 'admin@example.com',
        password: hashedPassword,
        role: 'admin',
        isEmailVerified: true
      });
    } else {
      admin.role = 'admin';
      admin.password = hashedPassword;
      await admin.save();
    }
    console.log('Admin user ready (admin@example.com / Password123!)');

    // Create Customer
    let customer = await User.findOne({ email: 'customer@example.com' });
    if (!customer) {
      customer = await User.create({
        name: 'Normal Customer',
        email: 'customer@example.com',
        password: hashedPassword,
        role: 'customer',
        isEmailVerified: true
      });
    } else {
      customer.password = hashedPassword;
      await customer.save();
    }
    console.log('Customer user ready (customer@example.com / Password123!)');

    // Create Pending Seller
    let pendingSeller = await User.findOne({ email: 'pendingseller@example.com' });
    if (!pendingSeller) {
      pendingSeller = await User.create({
        name: 'Pending Seller',
        email: 'pendingseller@example.com',
        password: hashedPassword,
        role: 'customer',
        isEmailVerified: true
      });
      await SellerApplication.create({
        user: pendingSeller._id,
        businessName: 'Pending Store',
        businessType: 'individual',
        contactEmail: 'pendingseller@example.com',
        businessAddress: '123 Pending St',
        city: 'Pending City',
        state: 'Pending State',
        postalCode: '123456',
        status: 'pending'
      });
    } else {
      pendingSeller.password = hashedPassword;
      await pendingSeller.save();
    }
    console.log('Pending Seller ready (pendingseller@example.com / Password123!)');

    // Create Approved Seller
    let approvedSeller = await User.findOne({ email: 'approvedseller@example.com' });
    if (!approvedSeller) {
      approvedSeller = await User.create({
        name: 'Approved Seller',
        email: 'approvedseller@example.com',
        password: hashedPassword,
        role: 'seller',
        isEmailVerified: true
      });
      
      const app = await SellerApplication.create({
        user: approvedSeller._id,
        businessName: 'Approved Store',
        businessType: 'small_business',
        contactEmail: 'approvedseller@example.com',
        businessAddress: '123 Approved St',
        city: 'Approved City',
        state: 'Approved State',
        postalCode: '654321',
        status: 'approved',
        reviewedBy: admin._id,
        reviewedAt: new Date()
      });
      
      await Seller.create({
        user: approvedSeller._id,
        businessName: 'Approved Store',
        sellerApplication: app._id
      });
    } else {
      approvedSeller.password = hashedPassword;
      await approvedSeller.save();
    }
    console.log('Approved Seller ready (approvedseller@example.com / Password123!)');

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

setup();
