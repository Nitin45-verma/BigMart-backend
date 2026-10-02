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
app.use(helmet());

// Enable CORS
app.use(cors());

// Parse cookie headers
app.use(cookieParser());

// Initialize Passport middleware
app.use(passport.initialize());

// Parse JSON payload
app.use(express.json());

// Parse URL-encoded body
app.use(express.urlencoded({ extended: true }));

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
