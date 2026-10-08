require('dotenv').config();
const connectDB = require('./src/config/db');
const User = require('./src/models/User');

async function findUser() {
  try {
    await connectDB();
    const user = await User.findOne({ isEmailVerified: true });
    if (user) {
      console.log('Verified user found:');
      console.log('ID:', user._id.toString());
      console.log('Email:', user.email);
      console.log('Name:', user.name);
      console.log('Role:', user.role);
      console.log('Email Verified:', user.isEmailVerified);
      console.log('Blocked:', user.isBlocked);
    } else {
      console.log('No verified user found.');
    }
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
findUser();
