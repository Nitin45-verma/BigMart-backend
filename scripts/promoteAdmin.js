require('dotenv').config();
const connectDB = require('../src/config/db');
const User = require('../src/models/User');

const promoteAdmin = async () => {
  const emailArgs = process.argv.slice(2);
  
  if (emailArgs.length === 0) {
    console.error('Usage: node promoteAdmin.js <user-email>');
    process.exit(1);
  }

  const email = emailArgs[0].toLowerCase().trim();

  try {
    await connectDB();
    console.log(`Searching for user with email: ${email}`);

    const user = await User.findOne({ email });

    if (!user) {
      console.error('Error: User not found.');
      process.exit(1);
    }

    if (!user.isEmailVerified) {
      console.error('Error: User email is not verified. Only verified users can be promoted to admin.');
      process.exit(1);
    }

    if (user.role === 'admin') {
      console.log('User is already an admin.');
      process.exit(0);
    }

    user.role = 'admin';
    await user.save();

    console.log(`Success: User ${user.email} has been promoted to admin.`);
    process.exit(0);
  } catch (error) {
    console.error(`Error promoting user: ${error.message}`);
    process.exit(1);
  }
};

promoteAdmin();
