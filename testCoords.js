require('dotenv').config();
const mongoose = require('mongoose');
const Address = require('./src/models/Address');
const User = require('./src/models/User');

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected');
  
  const user = await User.findOne();
  if (!user) return console.log('No user');

  try {
    const address = await Address.create({
      user: user._id,
      fullName: 'Test User',
      addressLine1: '123 Test St',
      city: 'Delhi',
      state: 'Delhi',
      postalCode: '110001',
      country: 'India',
      latitude: 28.6139,
      longitude: 77.2090
    });
    console.log('Saved Address:', address);
  } catch (err) {
    console.log('Error:', err.message);
  }
  
  mongoose.disconnect();
}
test();
