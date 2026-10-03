const Razorpay = require('razorpay');
const crypto = require('crypto');

/**
 * Razorpay SDK Service wrapper.
 * Reads API credentials strictly from process.env.
 * Never logs or exposes secret keys.
 */
let razorpayInstance = null;

const getKeyId = () => (process.env.RAZORPAY_KEY_ID || '').trim();
const getKeySecret = () => (process.env.RAZORPAY_KEY_SECRET || '').trim();

const isConfigured = () => {
  return Boolean(getKeyId() && getKeySecret());
};

const getRazorpayInstance = () => {
  if (!razorpayInstance && isConfigured()) {
    razorpayInstance = new Razorpay({
      key_id: getKeyId(),
      key_secret: getKeySecret()
    });
  }
  return razorpayInstance;
};

/**
 * Creates a Razorpay Order in paise.
 */
const createRazorpayOrder = async ({ amountPaise, currency = 'INR', receipt, notes = {} }) => {
  const instance = getRazorpayInstance();

  if (instance) {
    const options = {
      amount: amountPaise,
      currency,
      receipt,
      notes
    };
    const order = await instance.orders.create(options);
    return {
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      status: order.status,
      receipt: order.receipt
    };
  }

  // Development / test fallback when live credentials are not set
  const mockId = `rzp_mock_ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  return {
    id: mockId,
    amount: amountPaise,
    currency,
    status: 'created',
    receipt
  };
};

/**
 * Verifies Razorpay payment signature using HMAC SHA256.
 */
const verifyPaymentSignature = ({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) => {
  const secret = getKeySecret();

  if (!secret) {
    // In mock mode without secret key, accept mock test signatures
    if (razorpayOrderId.startsWith('rzp_mock_ord_')) {
      return true;
    }
    return false;
  }

  const payload = `${razorpayOrderId}|${razorpayPaymentId}`;
  const generatedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return generatedSignature === razorpaySignature;
};

/**
 * Processes a refund for a given Razorpay payment ID.
 */
const refundPayment = async ({ paymentId, amountPaise, notes = {} }) => {
  const instance = getRazorpayInstance();

  if (instance && paymentId && !paymentId.startsWith('rzp_mock_pay_')) {
    const refund = await instance.payments.refund(paymentId, {
      amount: amountPaise,
      notes
    });
    return {
      id: refund.id,
      amount: refund.amount,
      currency: refund.currency,
      status: refund.status,
      paymentId: refund.payment_id
    };
  }

  // Development / mock fallback when live credentials are not set or in test mode
  const mockRefundId = `rfnd_mock_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  return {
    id: mockRefundId,
    amount: amountPaise,
    currency: 'INR',
    status: 'processed',
    paymentId: paymentId || 'rzp_mock_pay_test'
  };
};

module.exports = {
  getKeyId,
  isConfigured,
  createRazorpayOrder,
  verifyPaymentSignature,
  refundPayment
};

