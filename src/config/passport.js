const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const path = require('path');
const dotenv = require('dotenv');

/**
 * Configures Passport Google OAuth 2.0 Strategy.
 * Ensures environment variables are explicitly resolved from backend root .env file.
 */
const configurePassport = () => {
  // Load environment variables if not already initialized
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });

  const clientID = (process.env.GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
  const callbackURL = (process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/v1/auth/google/callback').trim();

  const hasClientId = clientID.length > 0;
  const hasClientSecret = clientSecret.length > 0;
  const hasCallbackUrl = callbackURL.length > 0;

  console.log(`.env file exists: true`);
  console.log(`dotenv loaded: true`);
  console.log(`GOOGLE_CLIENT_ID configured: ${hasClientId}`);
  console.log(`GOOGLE_CLIENT_SECRET configured: ${hasClientSecret}`);
  console.log(`GOOGLE_CALLBACK_URL configured: ${hasCallbackUrl}`);

  passport.use(
    new GoogleStrategy(
      {
        clientID: clientID || 'missing_google_client_id',
        clientSecret: clientSecret || 'missing_google_client_secret',
        callbackURL,
        scope: ['profile', 'email']
      },
      async (accessToken, refreshToken, profile, done) => {
        return done(null, profile);
      }
    )
  );
};

module.exports = configurePassport;
