const mongoose = require('mongoose');
const dns = require('dns');

/**
 * Connects to MongoDB database using Mongoose.
 * Environment variable MONGO_URI must be set in process.env.
 */
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
      throw new Error('MONGO_URI is not defined in environment variables.');
    }

    // Configure DNS servers to reliably resolve MongoDB Atlas SRV records
    try {
      dns.setServers(['8.8.8.8', '1.1.1.1']);
    } catch (dnsError) {
      // Fallback silently if custom DNS setting fails
    }

    const conn = await mongoose.connect(mongoUri);

    console.log(`[MongoDB] Connected successfully to host: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`[MongoDB] Connection error: ${error.message}`);
    // Rethrow to allow server startup wrapper to handle failure cleanly
    throw error;
  }
};

module.exports = connectDB;
