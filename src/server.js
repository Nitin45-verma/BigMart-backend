const path = require('path');
const dotenv = require('dotenv');

// Explicitly load .env from backend root directory before importing app
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

let server;

/**
 * Initializes database connection and starts Express HTTP server.
 */
const startServer = async () => {
  try {
    // Connect to MongoDB using Mongoose
    await connectDB();

    // Start server
    server = app.listen(PORT, () => {
      console.log(`[Server] Running on port ${PORT}`);
    });
  } catch (error) {
    console.error(`[Server] Startup failed: ${error.message}`);
    process.exit(1);
  }
};

// Handle unhandled promise rejections cleanly
process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unhandled Rejection:', reason?.message || reason);
  if (server) {
    server.close(() => process.exit(1));
  } else {
    process.exit(1);
  }
});

// Handle uncaught exceptions cleanly
process.on('uncaughtException', (error) => {
  console.error('[Server] Uncaught Exception:', error.message);
  process.exit(1);
});

startServer();
