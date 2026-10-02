const path = require('path');
const dotenv = require('dotenv');

// Explicitly load .env from backend root with override
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });

const diagnosePassport = () => {
  console.log('\n========================================');
  console.log('DIAGNOSING PASSPORT GOOGLE OAUTH CONFIG');
  console.log('========================================\n');

  const rawClientId = process.env.GOOGLE_CLIENT_ID;
  const rawClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackUrl = process.env.GOOGLE_CALLBACK_URL;

  const hasClientId = !!rawClientId && rawClientId.trim().length > 0;
  const hasClientSecret = !!rawClientSecret && rawClientSecret.trim().length > 0;

  console.log('GOOGLE_CLIENT_ID configured:', hasClientId);
  console.log('GOOGLE_CLIENT_SECRET configured:', hasClientSecret);
  console.log('GOOGLE_CALLBACK_URL format:', callbackUrl || 'N/A');

  if (hasClientId) {
    console.log('GOOGLE_CLIENT_ID ends with .apps.googleusercontent.com:', rawClientId.trim().endsWith('.apps.googleusercontent.com'));
    console.log('GOOGLE_CLIENT_ID contains spaces:', /\s/.test(rawClientId));
  }

  if (!hasClientId || !hasClientSecret) {
    console.error('\n❌ DIAGNOSIS: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is empty/missing in process.env!');
  } else {
    console.log('\n✓ DIAGNOSIS: Credentials exist in process.env. Trimming and passing directly to Passport strategy.');
  }
};

diagnosePassport();
