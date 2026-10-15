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

// Allowed Origins List (Localhost + Production Vercel App)
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://big-mart-woad.vercel.app', // Your Vercel domain
  process.env.FRONTEND_URL
].filter(Boolean); // Remove undefined/null if FRONTEND_URL is not set

// Enable CORS
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman) or matched allowed origins
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS policy'));
    }
  },
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

// Root Route Endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running smoothly!"
  });
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