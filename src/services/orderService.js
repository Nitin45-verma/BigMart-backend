const crypto = require('crypto');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Seller = require('../models/Seller');
const User = require('../models/User');
const Address = require('../models/Address');
const ApiError = require('../utils/ApiError');
const { roundMoney, toPaise, calculateGST } = require('../utils/moneyUtils');
const razorpayService = require('./razorpayService');
const notificationService = require('./notificationService');
const emailService = require('./emailService');
const couponService = require('./couponService');
const CouponUsage = require('../models/CouponUsage');
const Coupon = require('../models/Coupon');

/**
 * Generates a human-friendly unique order number (e.g. BM-20261003-8F3K9A1Z)
 */
const generateOrderNumber = async () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  let orderNumber;
  let isUnique = false;

  while (!isUnique) {
    const randomSuffix = crypto.randomBytes(4).toString('hex').toUpperCase();
    orderNumber = `BM-${dateStr}-${randomSuffix}`;
    const existing = await Order.findOne({ orderNumber });
    if (!existing) isUnique = true;
  }

  return orderNumber;
};

/**
 * Customer creates an order from active Cart items.
 * Recalculates all financial values on the server using fresh database values.
 */
const createOrder = async (userId, addressId, couponCode = null) => {
  // 1. Verify shipping address ownership
  const address = await Address.findOne({ _id: addressId, user: userId });
  if (!address) {
    throw new ApiError(400, 'Valid shipping address belonging to you is required');
  }

  // 2. Create immutable shipping address snapshot
  const shippingAddressSnapshot = {
    fullName: address.fullName,
    phone: address.phone,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2,
    landmark: address.landmark,
    city: address.city,
    state: address.state,
    country: address.country || 'India',
    postalCode: address.postalCode,
    latitude: address.latitude,
    longitude: address.longitude
  };

  // 3. Fetch user's Cart
  const cart = await Cart.findOne({ user: userId });
  if (!cart || !cart.items || cart.items.length === 0) {
    throw new ApiError(400, 'Your cart is empty. Add products before checking out');
  }

  const orderItemSnapshots = [];
  let calculatedSubtotal = 0;
  let calculatedGstTotal = 0;
  let calculatedGrandTotal = 0;

  // 4. Validate products & calculate financial snapshots using DB source of truth
  for (const item of cart.items) {
    const product = await Product.findById(item.product).select('+costPrice');
    if (!product || product.status !== 'active' || !product.isPublished) {
      throw new ApiError(400, `Product '${product?.name || 'item'}' is no longer available`);
    }

    if (product.stock < item.quantity) {
      throw new ApiError(
        409,
        `Insufficient stock for '${product.name}'. Available: ${product.stock}, requested: ${item.quantity}`
      );
    }

    const unitPrice = roundMoney(product.price);
    const gstRate = product.gstRate || 0;
    const { basePrice, gstAmount } = calculateGST(unitPrice, gstRate);

    const itemSubtotal = roundMoney(basePrice * item.quantity);
    const itemGstTotal = roundMoney(gstAmount * item.quantity);
    const itemTotal = roundMoney(unitPrice * item.quantity);

    calculatedSubtotal = roundMoney(calculatedSubtotal + itemSubtotal);
    calculatedGstTotal = roundMoney(calculatedGstTotal + itemGstTotal);
    calculatedGrandTotal = roundMoney(calculatedGrandTotal + itemTotal);

    orderItemSnapshots.push({
      product: product._id,
      seller: product.seller,
      name: product.name,
      sku: product.sku,
      quantity: item.quantity,
      unitPrice,
      costPrice: typeof product.costPrice === 'number' ? product.costPrice : null,
      gstRate,
      gstAmount,
      itemSubtotal,
      itemTotal
    });
  }

  // 5. Calculate multi-vendor geographic shipping fees & build immutable snapshot
  const shippingService = require('./shippingService');
  const shippingQuote = await shippingService.getShippingQuote(userId, addressId);
  const deliveryFee = shippingQuote.totalDeliveryFee;
  const platformFee = 0;
  
  let discount = 0;
  let couponSnapshot = undefined;
  
  if (couponCode) {
    const validationResult = await couponService.validateCouponForCustomer(userId, couponCode);
    discount = validationResult.discountAmount;
    couponSnapshot = {
      couponId: validationResult.coupon._id,
      code: validationResult.coupon.code,
      discountType: validationResult.coupon.discountType,
      discountValue: validationResult.coupon.discountValue,
      discountAmount: discount
    };
  }

  const shippingSnapshot = {
    totalDeliveryFee: shippingQuote.totalDeliveryFee,
    sellers: shippingQuote.shipping.map((s) => ({
      seller: s.sellerId,
      sellerName: s.sellerName,
      distanceKm: s.distanceKm,
      billableDistanceKm: s.billableDistanceKm,
      deliveryFee: s.deliveryFee
    }))
  };

  let grandTotal = roundMoney(calculatedGrandTotal + deliveryFee - discount);
  if (grandTotal < 0) grandTotal = 0;
  
  const grandTotalPaise = toPaise(grandTotal);

  // 6. Generate unique order number
  const orderNumber = await generateOrderNumber();

  // 6. Create Razorpay order
  const razorpayOrder = await razorpayService.createRazorpayOrder({
    amountPaise: grandTotalPaise,
    currency: 'INR',
    receipt: orderNumber,
    notes: { user_id: userId.toString() }
  });

  // 7. Save Order in MongoDB
  const order = await Order.create({
    orderNumber,
    user: userId,
    items: orderItemSnapshots,
    shippingAddress: shippingAddressSnapshot,
    shipping: shippingSnapshot,
    subtotal: roundMoney(calculatedSubtotal),
    gstTotal: roundMoney(calculatedGstTotal),
    deliveryFee,
    platformFee,
    discount,
    coupon: couponSnapshot,
    grandTotal,
    payment: {
      provider: 'razorpay',
      razorpayOrderId: razorpayOrder.id,
      status: 'created'
    },
    orderStatus: 'pending_payment'
  });

  // ── POST-DB: Notifications & Email (fire-and-forget; never blocks business result) ──
  setImmediate(async () => {
    try {
      // Build per-seller summaries for multi-vendor isolation
      const sellerMap = new Map();
      for (const item of order.items) {
        const sId = item.seller.toString();
        if (!sellerMap.has(sId)) sellerMap.set(sId, { itemCount: 0, sellerSubtotal: 0 });
        const entry = sellerMap.get(sId);
        entry.itemCount += item.quantity;
        entry.sellerSubtotal = roundMoney(entry.sellerSubtotal + item.itemTotal);
      }

      // Resolve seller user IDs for notifications
      const sellerUserIds = [];
      for (const [sId, summary] of sellerMap.entries()) {
        const sellerDoc = await Seller.findById(sId).select('user businessName').lean();
        if (sellerDoc?.user) {
          sellerUserIds.push({ userId: sellerDoc.user.toString(), ...summary, sellerName: sellerDoc.businessName });
        }
      }

      await notificationService.notifyOrderPlaced({ order, userId, sellerUserIds });

      // Customer email (order confirmation)
      const customerUser = await User.findById(userId).select('name email').lean();
      if (customerUser?.email) {
        await emailService.sendOrderConfirmationEmail({
          toEmail: customerUser.email,
          userName: customerUser.name,
          orderNumber: order.orderNumber,
          grandTotal: order.grandTotal
        });
      }

      // Seller emails (one per seller)
      for (const sellerInfo of sellerUserIds) {
        const sellerUser = await User.findById(sellerInfo.userId).select('name email').lean();
        if (sellerUser?.email) {
          await emailService.sendSellerOrderNotificationEmail({
            toEmail: sellerUser.email,
            sellerName: sellerInfo.sellerName || sellerUser.name,
            orderNumber: order.orderNumber,
            itemCount: sellerInfo.itemCount
          });
        }
      }
    } catch (notifErr) {
      console.error('[OrderService] Post-order notification error (non-critical):', notifErr.message);
    }
  });

  return {
    orderId: order._id,
    orderNumber: order.orderNumber,
    razorpayOrderId: razorpayOrder.id,
    amount: order.grandTotal,
    amountPaise: grandTotalPaise,
    currency: 'INR',
    keyId: razorpayService.getKeyId() || 'rzp_test_mock_key',
    order
  };
};

/**
 * Verifies Razorpay payment signature, performs atomic stock decrement, updates Order state, and clears Cart.
 */
const verifyPayment = async (userId, { razorpay_order_id, razorpay_payment_id, razorpay_signature }) => {
  const order = await Order.findOne({ 'payment.razorpayOrderId': razorpay_order_id });
  if (!order) {
    throw new ApiError(404, 'Order not found for the given Razorpay Order ID');
  }

  // Ownership Check
  if (order.user.toString() !== userId.toString()) {
    throw new ApiError(403, 'Access denied: Order does not belong to you');
  }

  // Idempotency: If already paid, return existing state without duplicate operations
  if (order.payment.status === 'paid' && order.orderStatus === 'paid') {
    return {
      message: 'Payment already verified',
      order
    };
  }

  // Signature verification
  const isValidSignature = razorpayService.verifyPaymentSignature({
    razorpayOrderId: razorpay_order_id,
    razorpayPaymentId: razorpay_payment_id,
    razorpaySignature: razorpay_signature
  });

  if (!isValidSignature) {
    order.payment.status = 'failed';
    await order.save();
    // ── POST-DB: Payment failure notification (fire-and-forget) ──
    setImmediate(async () => {
      try {
        await notificationService.notifyPaymentFailed({ order, userId });
        const customerUser = await User.findById(userId).select('name email').lean();
        if (customerUser?.email) {
          await emailService.sendPaymentFailedEmail({
            toEmail: customerUser.email,
            userName: customerUser.name,
            orderNumber: order.orderNumber
          });
        }
      } catch (notifErr) {
        console.error('[OrderService] Post-payment-fail notification error (non-critical):', notifErr.message);
      }
    });
    throw new ApiError(400, 'Invalid payment signature');
  }

  const inventoryService = require('./inventoryService'); // Import here to avoid circular dep if any

  // Stock Concurrency Protection: Atomic conditional stock decrement
  for (const item of order.items) {
    const updatedProduct = await Product.findOneAndUpdate(
      { _id: item.product, stock: { $gte: item.quantity } },
      { $inc: { stock: -item.quantity } },
      { new: true }
    );

    if (!updatedProduct) {
      order.payment.status = 'failed';
      order.orderStatus = 'cancelled';
      await order.save();
      throw new ApiError(
        409,
        `Item '${item.name}' went out of stock during payment processing`
      );
    }

    // Record the inventory movement
    await inventoryService.recordMovement({
      product: item.product,
      seller: item.seller,
      type: 'ORDER_DEDUCTED',
      quantity: item.quantity,
      previousStock: updatedProduct.stock + item.quantity,
      newStock: updatedProduct.stock,
      reason: `Order placed: ${order._id}`,
      referenceType: 'Order',
      referenceId: order._id,
      performedBy: order.user
    });
  }

  if (order.coupon && order.coupon.couponId) {
    const couponId = order.coupon.couponId;
    const coupon = await Coupon.findById(couponId);
    if (coupon) {
      if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
        order.payment.status = 'failed';
        order.orderStatus = 'cancelled';
        await order.save();
        throw new ApiError(409, 'Coupon usage limit reached during payment processing');
      }
      
      if (coupon.perCustomerLimit !== null) {
        const userUsageCount = await CouponUsage.countDocuments({ coupon: couponId, customer: userId });
        if (userUsageCount >= coupon.perCustomerLimit) {
          order.payment.status = 'failed';
          order.orderStatus = 'cancelled';
          await order.save();
          throw new ApiError(409, 'You have already reached the usage limit for this coupon');
        }
      }

      await CouponUsage.create({
        coupon: couponId,
        customer: userId,
        order: order._id,
        discountAmount: order.coupon.discountAmount
      });
      await Coupon.updateOne({ _id: couponId }, { $inc: { usedCount: 1 } });
    }
  }

  // Update order status to paid
  order.payment.razorpayPaymentId = razorpay_payment_id;
  order.payment.razorpaySignature = razorpay_signature;
  order.payment.status = 'paid';
  order.orderStatus = 'paid';
  await order.save();

  // Clear purchased items from Cart after successful verification
  const purchasedProductIds = order.items.map((i) => i.product);
  await Cart.updateOne(
    { user: userId },
    { $pull: { items: { product: { $in: purchasedProductIds } } } }
  );

  // Create Fulfillment records for each seller
  const fulfillmentService = require('./fulfillmentService');
  await fulfillmentService.createFulfillmentsForOrder(order);


  // ── POST-DB: Payment success notifications (fire-and-forget) ──
  setImmediate(async () => {
    try {
      await notificationService.notifyPaymentSuccess({ order, userId });
      const customerUser = await User.findById(userId).select('name email').lean();
      if (customerUser?.email) {
        await emailService.sendPaymentSuccessEmail({
          toEmail: customerUser.email,
          userName: customerUser.name,
          orderNumber: order.orderNumber,
          grandTotal: order.grandTotal
        });
      }
    } catch (notifErr) {
      console.error('[OrderService] Post-payment notification error (non-critical):', notifErr.message);
    }
  });

  return {
    message: 'Payment verified and order placed successfully',
    order
  };
};

/**
 * Customer views list of own orders.
 */
const getUserOrders = async (userId, { page = 1, limit = 20 }) => {
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
  const skip = (pageNum - 1) * limitNum;

  const orders = await Order.find({ user: userId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum);

  const total = await Order.countDocuments({ user: userId });

  return {
    orders,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum)
  };
};

/**
 * Customer views single order details (ownership protected).
 */
const getOrderById = async (userId, orderId) => {
  const order = await Order.findOne({ _id: orderId, user: userId });
  if (!order) {
    throw new ApiError(404, 'Order not found or access denied');
  }

  return order;
};

module.exports = {
  createOrder,
  verifyPayment,
  getUserOrders,
  getOrderById
};
