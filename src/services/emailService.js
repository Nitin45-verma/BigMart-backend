const nodemailer = require('nodemailer');

/**
 * Creates standard Nodemailer SMTP transporter using environment variables.
 * Supports both EMAIL_PASSWORD and EMAIL_PASS environment variable names.
 */
const createTransporter = () => {
  const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
  const port = Number(process.env.EMAIL_PORT) || 587;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASSWORD || process.env.EMAIL_PASS;

  const transporterConfig = {
    host,
    port,
    secure: port === 465,
    tls: {
      rejectUnauthorized: false
    }
  };

  if (user && pass) {
    transporterConfig.auth = {
      user,
      pass
    };
  }

  return nodemailer.createTransport(transporterConfig);
};

/**
 * Verifies Nodemailer SMTP transporter connectivity safely without exposing credentials.
 */
const verifyTransporter = async () => {
  try {
    const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
    const port = Number(process.env.EMAIL_PORT) || 587;
    const userPresent = !!process.env.EMAIL_USER;
    const passRaw = process.env.EMAIL_PASSWORD || process.env.EMAIL_PASS;
    const passPresent = !!passRaw;

    console.log(`[EmailService] Verifying SMTP connection to ${host}:${port}...`);
    console.log(`[EmailService] Config check -> User configured: ${userPresent}, Password configured: ${passPresent}`);

    const transporter = createTransporter();
    await transporter.verify();

    console.log(`[EmailService] SMTP Transporter authenticated successfully with ${host}:${port}`);
    return {
      success: true,
      host,
      port,
      userPresent,
      passPresent,
      message: 'SMTP Transporter verified successfully'
    };
  } catch (error) {
    console.error(`[EmailService] SMTP Transporter verification failed: ${error.message}`);
    return {
      success: false,
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: Number(process.env.EMAIL_PORT) || 587,
      message: `SMTP Transporter verification failed: ${error.message}`
    };
  }
};

/**
 * Sends a verification email to a user.
 */
const sendVerificationEmail = async ({ toEmail, userName, rawToken }) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const verificationUrl = `${frontendUrl}/verify-email?token=${rawToken}`;
  const sender = process.env.EMAIL_FROM || process.env.EMAIL_USER || '"BigMart Marketplace" <no-reply@bigmart.com>';

  const subject = 'Verify Your BigMart Account Email';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Email Verification - BigMart</title>
      <style>
        body { font-family: Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 20px; color: #333; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        .header { text-align: center; border-bottom: 2px solid #e0e0e0; padding-bottom: 15px; margin-bottom: 20px; }
        .header h1 { color: #2c3e50; margin: 0; }
        .button { display: inline-block; padding: 12px 24px; margin: 20px 0; background-color: #2563eb; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: bold; }
        .footer { margin-top: 30px; font-size: 12px; color: #777777; text-align: center; border-top: 1px solid #eeeeee; padding-top: 15px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>BigMart Marketplace</h1>
        </div>
        <p>Hello ${userName},</p>
        <p>Thank you for registering an account on BigMart Marketplace! Please click the button below to verify your email address and activate your account:</p>
        <div style="text-align: center;">
          <a href="${verificationUrl}" class="button" target="_blank">Verify Email Address</a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p><a href="${verificationUrl}">${verificationUrl}</a></p>
        <p><strong>Note:</strong> This verification link will expire in 30 minutes for security reasons.</p>
        <p>If you did not create an account on BigMart, please ignore this email.</p>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} BigMart Marketplace. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
Hello ${userName},

Thank you for creating an account on BigMart Marketplace.

Please verify your email address by opening the following link in your browser:
${verificationUrl}

This verification link will expire in 30 minutes.

If you did not request this account, please ignore this email.

Best regards,
BigMart Marketplace Team
  `.trim();

  const transporter = createTransporter();
  const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
  const port = Number(process.env.EMAIL_PORT) || 587;

  console.log(`[EmailService] Sending verification email via SMTP (${host}:${port}) to: ${toEmail}`);

  try {
    const info = await transporter.sendMail({
      from: sender,
      to: toEmail,
      subject,
      text: textContent,
      html: htmlContent
    });

    console.log(`[EmailService] Verification email sent via SMTP. Recipient: ${toEmail}, MessageId: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`[EmailService] Failed to send email via SMTP to ${toEmail}: ${error.message}`);
    throw error;
  }
};

/**
 * Sends seller application approval notification email.
 */
const sendSellerApplicationApprovedEmail = async ({ toEmail, userName, businessName }) => {
  const sender = process.env.EMAIL_FROM || process.env.EMAIL_USER || '"BigMart Marketplace" <no-reply@bigmart.com>';
  const subject = 'Congratulations! Your BigMart Seller Application is Approved';

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
      <h2>Seller Application Approved!</h2>
      <p>Hello ${userName},</p>
      <p>We are excited to inform you that your seller application for <strong>${businessName}</strong> has been approved!</p>
      <p>Your account role has been updated to <strong>Seller</strong>. You can now log in and access your seller management tools.</p>
      <p>Welcome to BigMart Marketplace!</p>
    </div>
  `;

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: sender,
      to: toEmail,
      subject,
      html: htmlContent
    });
  } catch (error) {
    console.error(`[EmailService] Failed to send seller approval email to ${toEmail}: ${error.message}`);
  }
};

/**
 * Sends seller application rejection notification email.
 */
const sendSellerApplicationRejectedEmail = async ({ toEmail, userName, businessName, rejectionReason }) => {
  const sender = process.env.EMAIL_FROM || process.env.EMAIL_USER || '"BigMart Marketplace" <no-reply@bigmart.com>';
  const subject = 'Update on Your BigMart Seller Application';

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
      <h2>Seller Application Status Update</h2>
      <p>Hello ${userName},</p>
      <p>Thank you for submitting a seller application for <strong>${businessName}</strong>.</p>
      <p>After review, we regret to inform you that your application was not approved at this time.</p>
      <p><strong>Reason:</strong> ${rejectionReason}</p>
      <p>You may update your details and submit a new seller application in the future.</p>
    </div>
  `;

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: sender,
      to: toEmail,
      subject,
      html: htmlContent
    });
  } catch (error) {
    console.error(`[EmailService] Failed to send seller rejection email to ${toEmail}: ${error.message}`);
  }
};

module.exports = {
  createTransporter,
  verifyTransporter,
  sendVerificationEmail,
  sendSellerApplicationApprovedEmail,
  sendSellerApplicationRejectedEmail
};
