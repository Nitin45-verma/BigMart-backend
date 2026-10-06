require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

const setup = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  
  const email = 'testverified@example.com';
  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({
      name: 'Test Verified',
      email,
      password: 'password123',
      role: 'customer',
      isEmailVerified: true
    });
  } else {
    user.isEmailVerified = true;
    user.password = 'password123';
    await user.save();
  }
  
  console.log('Verified test user created');
  process.exit(0);
};

setup().catch(err => {
  console.error(err);
  process.exit(1);
});
