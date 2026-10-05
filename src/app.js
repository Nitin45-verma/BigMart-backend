const path = require('path');
const dotenv = require('dotenv');

// Load environment variables before importing app submodules
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const configurePassport = require('./config/passport');
const routes = require('./routes');
const notFoundHandler = require('./middleware/notFound.middleware');
const errorHandler = require('./middleware/error.middleware');

const app = express();

// Initialize Passport strategy configuration
configurePassport();

// Security HTTP headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin images if necessary, otherwise tighten
}));

// Enable CORS
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// Parse cookie headers
app.use(cookieParser());

// Initialize Passport middleware
app.use(passport.initialize());

// Parse JSON payload (with safe limit)
app.use(express.json({ limit: '1mb' }));

// Parse URL-encoded body
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Server is healthy' });
});


// HTTP logging in development environment
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// API v1 routes
app.use('/api/v1', routes);

// Handle undefined routes (404)
app.use(notFoundHandler);

// Centralized error handling middleware
app.use(errorHandler);

module.exports = app;
