const path = require('path');
const dotenv = require('dotenv');

// Explicitly load .env file from backend root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const emailService = require('../services/emailService');

const diagnose = async () => {
  console.log('\n========================================');
  console.log('DIAGNOSING NODEMAILER / SMTP SETUP');
  console.log('========================================\n');

  console.log('Testing SMTP Transporter Verification...');
  const verifyResult = await emailService.verifyTransporter();

  console.log('Transporter Verification Success:', verifyResult.success);
  console.log('Transporter Is JSON Mode:', verifyResult.isJsonTransport);
  if (verifyResult.host) console.log('SMTP Host:', verifyResult.host);
  if (verifyResult.port) console.log('SMTP Port:', verifyResult.port);
  if (verifyResult.sender) console.log('Sender Address:', verifyResult.sender);
  console.log('Verification Message:', verifyResult.message);

  if (!verifyResult.success) {
    console.error('\n❌ Transporter verification failed.');
    process.exit(1);
  }

  console.log('\nAttempting to send real test verification email...');
  const testRecipient = process.env.EMAIL_USER || process.env.EMAIL_FROM || 'test@example.com';
  const dummyToken = 'test_diag_' + Date.now();

  try {
    const sendResult = await emailService.sendVerificationEmail({
      toEmail: testRecipient,
      userName: 'Diagnostic Tester',
      rawToken: dummyToken
    });

    console.log('\n========================================');
    console.log('✓ REAL EMAIL SENT SUCCESSFULLY!');
    if (sendResult.messageId) console.log('MessageId:', sendResult.messageId);
    console.log('Recipient:', testRecipient);
    console.log('========================================\n');
  } catch (sendErr) {
    console.error('\n========================================');
    console.error('❌ SENDMAIL FAILED:');
    console.error('Safe Error Message:', sendErr.message);
    console.error('========================================\n');
    process.exit(1);
  }

  process.exit(0);
};

diagnose();
