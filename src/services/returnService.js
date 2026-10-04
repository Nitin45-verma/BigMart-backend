const mongoose = require('mongoose');
const ReturnRequest = require('../models/ReturnRequest');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Seller = require('../models/Seller');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { roundMoney, toPaise } = require('../utils/moneyUtils');
const razorpayService = require('./razorpayService');
const notificationService = require('./notificationService');
const emailService = require('./emailService');
const sellerWalletService = require('./sellerWalletService');

/**
 * Controlled Return Request state transitions map.
 */
const ALLOWED_TRANSITIONS = {
  requested: ['approved', 'rejected', 'cancelled'],
  approved: ['received', 'refund_pending', 'refunded'],
  received: ['refund_pending', 'refunded'],
  refund_pending: ['refunded'],
  rejected: [],
  refunded: [],
  cancelled: []
};

/**
 * Validates return status transition.
 */
const validateStatusTransition = (currentStatus, targetStatus) => {
  const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(targetStatus)) {
    throw new ApiError(
      422,
      `Cannot transition return request from '${currentStatus}' to '${targetStatus}'`
    );
  }
};

/**
 * Customer: Cancel order workflow.
 * Atomically cancels order, restores stock if paid, and triggers refund.
 */
const cancelOrder = async (userId, orderId, reason) => {
  const order = await Order.findOne({ _id: orderId, user: userId });
  if (!order) {
    throw new ApiError(404, 'Order not found or access denied');
  }

  // Non-cancellable states
  const nonCancellableStates = ['delivered', 'cancelled', 'refunded'];
  if (nonCancellableStates.includes(order.orderStatus)) {
    throw new ApiError(
      422,
      `Order cannot be cancelled because it is currently in '${order.orderStatus}' state`
    );
  }

  const wasPaid = order.payment.status === 'paid';

  order.orderStatus = 'cancelled';

  if (wasPaid) {
    // Restore stock atomically for all items in order
    const inventoryService = require('./inventoryService');
    for (const item of order.items) {
      const updatedProduct = await Product.findOneAndUpdate(
        { _id: item.product },
        { $inc: { stock: item.quantity } },
        { new: true }
      );
      if (updatedProduct) {
        await inventoryService.recordMovement({
          product: item.product,
          seller: item.seller,
          type: 'ORDER_CANCEL_RESTORED',
          quantity: item.quantity,
          previousStock: updatedProduct.stock - item.quantity,
          newStock: updatedProduct.stock,
          reason: `Order cancelled: ${order._id}`,
          referenceType: 'Order',
          referenceId: order._id,
          performedBy: userId
        });
      }
    }

    // Process refund if payment ID exists
    if (order.payment.razorpayPaymentId) {
      await razorpayService.refundPayment({
        paymentId: order.payment.razorpayPaymentId,
        amountPaise: toPaise(order.grandTotal),
        notes: { orderId: order._id.toString(), reason }
      });
    }

    order.payment.status = 'refunded';
    
    // Debit cancellation amount from all sellers in the order
    const sellers = new Set(order.items.map(item => item.seller.toString()));
    for (const sellerId of sellers) {
      await sellerWalletService.debitCancellationAmount(order._id, sellerId);
    }
  }

  await order.save();

  // ── POST-DB: Cancellation notifications (fire-and-forget) ──
  setImmediate(async () => {
    try {
      await notificationService.notifyOrderCancelled({ order, userId });
      const customerUser = await User.findById(userId).select('name email').lean();
      if (customerUser?.email) {
        await emailService.sendOrderCancelledEmail({
          toEmail: customerUser.email,
          userName: customerUser.name,
          orderNumber: order.orderNumber
        });
      }
    } catch (notifErr) {
      console.error('[ReturnService] Post-cancel notification error (non-critical):', notifErr.message);
    }
  });

  return {
    orderId: order._id,
    orderNumber: order.orderNumber,
    orderStatus: order.orderStatus,
    paymentStatus: order.payment.status,
    cancelledAt: order.updatedAt,
    reason
  };
};

/**
 * Customer: Create return request.
 * Supports item-level returns and multi-seller isolation by grouping per seller.
 */
const createReturnRequest = async (userId, orderId, { items, reason, description }) => {
  const order = await Order.findOne({ _id: orderId, user: userId });
  if (!order) {
    throw new ApiError(404, 'Order not found or access denied');
  }

  // Order must be in eligible state for return (delivered or shipped or paid)
  if (['pending_payment', 'cancelled'].includes(order.orderStatus)) {
    throw new ApiError(
      422,
      `Return request cannot be submitted for order in '${order.orderStatus}' state`
    );
  }

  // Fetch existing active return requests for this order to prevent duplicate returns
  const existingReturns = await ReturnRequest.find({
    order: orderId,
    status: { $nin: ['rejected', 'cancelled'] }
  });

  // Map of cumulative returned quantity per product ID
  const returnedQuantityMap = new Map();
  for (const ret of existingReturns) {
    for (const retItem of ret.items) {
      const pId = retItem.product.toString();
      const currentCount = returnedQuantityMap.get(pId) || 0;
      returnedQuantityMap.set(pId, currentCount + retItem.quantity);
    }
  }

  // Group requested items by seller
  const itemsBySeller = new Map();

  for (const itemReq of items) {
    const orderItem = order.items.find(
      (i) => i.product.toString() === itemReq.product.toString()
    );

    if (!orderItem) {
      throw new ApiError(
        400,
        `Product '${itemReq.product}' was not purchased in this order`
      );
    }

    const alreadyReturned = returnedQuantityMap.get(itemReq.product.toString()) || 0;
    const remainingEligible = orderItem.quantity - alreadyReturned;

    if (remainingEligible <= 0) {
      throw new ApiError(
        400,
        `Item '${orderItem.name}' has already been fully returned`
      );
    }

    if (itemReq.quantity > remainingEligible) {
      throw new ApiError(
        400,
        `Requested return quantity (${itemReq.quantity}) for '${orderItem.name}' exceeds remaining purchased quantity (${remainingEligible})`
      );
    }

    const sellerId = orderItem.seller.toString();
    if (!itemsBySeller.has(sellerId)) {
      itemsBySeller.set(sellerId, []);
    }

    itemsBySeller.get(sellerId).push({
      orderItem,
      requestedQty: itemReq.quantity
    });
  }

  const createdReturnRequests = [];

  // Create individual ReturnRequest document per seller for multi-seller isolation
  for (const [sellerId, sellerItemsGroup] of itemsBySeller.entries()) {
    let groupItemTotal = 0;

    const returnItemsSnapshot = sellerItemsGroup.map(({ orderItem, requestedQty }) => {
      // Calculate pro-rated item subtotal and total using original order snapshot
      const unitPrice = orderItem.unitPrice;
      const gstRate = orderItem.gstRate || 0;
      const gstAmount = orderItem.gstAmount || 0;
      const itemSubtotal = roundMoney((orderItem.itemSubtotal / orderItem.quantity) * requestedQty);
      const itemTotal = roundMoney((orderItem.itemTotal / orderItem.quantity) * requestedQty);

      groupItemTotal = roundMoney(groupItemTotal + itemTotal);

      return {
        product: orderItem.product,
        name: orderItem.name,
        sku: orderItem.sku,
        quantity: requestedQty,
        unitPrice,
        gstRate,
        gstAmount,
        itemSubtotal,
        itemTotal
      };
    });

    // Determine deterministic shipping fee refund allocation
    // If returning ALL items for this seller in the order, allocate seller's shipping fee snapshot
    let shippingRefund = 0;
    const sellerShippingSnapshot = order.shipping?.sellers?.find(
      (s) => s.seller.toString() === sellerId
    );

    if (sellerShippingSnapshot) {
      const allSellerOrderItems = order.items.filter(
        (i) => i.seller.toString() === sellerId
      );

      const isFullSellerReturn = allSellerOrderItems.every((sellerItem) => {
        const pId = sellerItem.product.toString();
        const alreadyRet = returnedQuantityMap.get(pId) || 0;
        const requestedInThisGroup = sellerItemsGroup.find(
          (g) => g.orderItem.product.toString() === pId
        )?.requestedQty || 0;

        return alreadyRet + requestedInThisGroup >= sellerItem.quantity;
      });

      if (isFullSellerReturn) {
        shippingRefund = sellerShippingSnapshot.deliveryFee || 0;
      }
    }

    const totalRefundAmount = roundMoney(groupItemTotal + shippingRefund);

    const returnDoc = await ReturnRequest.create({
      order: order._id,
      customer: userId,
      seller: sellerId,
      items: returnItemsSnapshot,
      reason,
      description: description ? description.trim() : undefined,
      status: 'requested',
      refundAmount: totalRefundAmount,
      shippingRefund,
      refundStatus: 'none'
    });

    createdReturnRequests.push(returnDoc);
  }

  // ── POST-DB: Return request notifications (fire-and-forget, per created return doc) ──
  setImmediate(async () => {
    try {
      const orderDoc = await Order.findById(orderId).select('orderNumber').lean();
      const orderNumber = orderDoc?.orderNumber || 'N/A';
      const customerUser = await User.findById(userId).select('name email').lean();
      // Collect admin user IDs for admin notifications
      const adminUsers = await User.find({ role: 'admin', isBlocked: false }).select('_id').lean();
      const adminUserIds = adminUsers.map((a) => a._id.toString());

      for (const returnDoc of createdReturnRequests) {
        // Resolve seller user ID
        const sellerDoc = await Seller.findById(returnDoc.seller).select('user businessName').lean();
        const sellerUserId = sellerDoc?.user?.toString() || null;
        const sellerName = sellerDoc?.businessName || 'Seller';

        await notificationService.notifyReturnRequested({
          returnRequest: returnDoc,
          customerUserId: userId,
          sellerUserId,
          adminUserIds,
          orderNumber
        });

        // Customer email
        if (customerUser?.email) {
          await emailService.sendReturnRequestedEmail({
            toEmail: customerUser.email,
            userName: customerUser.name,
            orderNumber,
            refundAmount: returnDoc.refundAmount
          });
        }
        // Seller email
        if (sellerUserId) {
          const sellerUser = await User.findById(sellerUserId).select('name email').lean();
          if (sellerUser?.email) {
            await emailService.sendSellerReturnNotificationEmail({
              toEmail: sellerUser.email,
              sellerName,
              orderNumber
            });
          }
        }
      }
    } catch (notifErr) {
      console.error('[ReturnService] Post-return-request notification error (non-critical):', notifErr.message);
    }
  });

  return createdReturnRequests.length === 1 ? createdReturnRequests[0] : createdReturnRequests;
};

/**
 * Customer: Get customer's return requests.
 */
const getCustomerReturns = async (userId, { page = 1, limit = 20, status }) => {
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
  const skip = (pageNum - 1) * limitNum;

  const query = { customer: userId };
  if (status) query.status = status;

  const [returns, total] = await Promise.all([
    ReturnRequest.find(query)
      .populate('order', 'orderNumber orderStatus grandTotal createdAt')
      .populate('seller', 'businessName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum),
    ReturnRequest.countDocuments(query)
  ]);

  return {
    returns,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum)
  };
};

/**
 * Customer: Get single return request by ID (ownership protected).
 */
const getCustomerReturnById = async (userId, returnId) => {
  const returnReq = await ReturnRequest.findOne({ _id: returnId, customer: userId })
    .populate('order', 'orderNumber orderStatus grandTotal createdAt')
    .populate('seller', 'businessName');

  if (!returnReq) {
    throw new ApiError(404, 'Return request not found or access denied');
  }

  return returnReq;
};

/**
 * Seller: Get seller's return requests with strict multi-seller isolation.
 */
const getSellerReturns = async (sellerId, { page = 1, limit = 20, status }) => {
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const query = { seller: sellerId };
  if (status) query.status = status;

  const [returns, total] = await Promise.all([
    ReturnRequest.find(query)
      .populate('order', 'orderNumber orderStatus createdAt')
      .populate('customer', 'fullName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum),
    ReturnRequest.countDocuments(query)
  ]);

  return {
    returns,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum)
  };
};

/**
 * Seller: Get single return request by ID (seller isolation enforced).
 */
const getSellerReturnById = async (sellerId, returnId) => {
  const returnReq = await ReturnRequest.findOne({ _id: returnId, seller: sellerId })
    .populate('order', 'orderNumber orderStatus createdAt')
    .populate('customer', 'fullName email');

  if (!returnReq) {
    throw new ApiError(404, 'Return request not found or does not belong to your account');
  }

  return returnReq;
};

/**
 * Seller: Approve return request.
 */
const approveSellerReturn = async (sellerId, returnId, userId) => {
  const returnReq = await ReturnRequest.findOne({ _id: returnId, seller: sellerId });
  if (!returnReq) {
    throw new ApiError(404, 'Return request not found or access denied');
  }

  validateStatusTransition(returnReq.status, 'approved');

  returnReq.status = 'approved';
  returnReq.reviewedAt = new Date();
  returnReq.reviewedBy = userId;

  // Restore stock for approved returned items (idempotency check)
  if (!returnReq.stockRestored) {
    const inventoryService = require('./inventoryService');
    for (const item of returnReq.items) {
      const updatedProduct = await Product.findOneAndUpdate(
        { _id: item.product },
        { $inc: { stock: item.quantity } },
        { new: true }
      );
      if (updatedProduct) {
        await inventoryService.recordMovement({
          product: item.product,
          seller: item.seller, // returnReq items might not have seller, but wait, item.product doesn't have seller either? No, we can get it from updatedProduct.seller.
          type: 'RETURN_RESTORED',
          quantity: item.quantity,
          previousStock: updatedProduct.stock - item.quantity,
          newStock: updatedProduct.stock,
          reason: `Return approved: ${returnReq._id}`,
          referenceType: 'ReturnRequest',
          referenceId: returnReq._id,
          performedBy: userId
        });
      }
    }
    returnReq.stockRestored = true;
  }

  await returnReq.save();

  // ── POST-DB: Seller return approval notifications (fire-and-forget) ──
  const returnReqRef = returnReq;
  setImmediate(async () => {
    try {
      const orderDoc = await Order.findById(returnReqRef.order).select('orderNumber').lean();
      const orderNumber = orderDoc?.orderNumber || 'N/A';
      const customerUserId = returnReqRef.customer?.toString();
      if (customerUserId) {
        await notificationService.notifyReturnApproved({
          returnRequest: returnReqRef,
          customerUserId,
          orderNumber
        });
        const customerUser = await User.findById(customerUserId).select('name email').lean();
        if (customerUser?.email) {
          await emailService.sendReturnApprovedEmail({
            toEmail: customerUser.email,
            userName: customerUser.name,
            orderNumber,
            refundAmount: returnReqRef.refundAmount
          });
        }
      }
    } catch (notifErr) {
      console.error('[ReturnService] Post-approve notification error (non-critical):', notifErr.message);
    }
  });

  return returnReq;
};

/**
 * Seller: Reject return request.
 */
const rejectSellerReturn = async (sellerId, returnId, userId, rejectionReason) => {
  const returnReq = await ReturnRequest.findOne({ _id: returnId, seller: sellerId });
  if (!returnReq) {
    throw new ApiError(404, 'Return request not found or access denied');
  }

  validateStatusTransition(returnReq.status, 'rejected');

  returnReq.status = 'rejected';
  returnReq.rejectionReason = rejectionReason.trim();
  returnReq.reviewedAt = new Date();
  returnReq.reviewedBy = userId;

  await returnReq.save();

  // ── POST-DB: Seller return rejection notifications (fire-and-forget) ──
  const rejReturnRef = returnReq;
  setImmediate(async () => {
    try {
      const orderDoc = await Order.findById(rejReturnRef.order).select('orderNumber').lean();
      const orderNumber = orderDoc?.orderNumber || 'N/A';
      const customerUserId = rejReturnRef.customer?.toString();
      if (customerUserId) {
        await notificationService.notifyReturnRejected({
          returnRequest: rejReturnRef,
          customerUserId,
          orderNumber
        });
        const customerUser = await User.findById(customerUserId).select('name email').lean();
        if (customerUser?.email) {
          await emailService.sendReturnRejectedEmail({
            toEmail: customerUser.email,
            userName: customerUser.name,
            orderNumber,
            rejectionReason: rejReturnRef.rejectionReason
          });
        }
      }
    } catch (notifErr) {
      console.error('[ReturnService] Post-reject notification error (non-critical):', notifErr.message);
    }
  });

  return returnReq;
};

/**
 * Admin: List all return requests with filters.
 */
const getAdminReturns = async ({ page = 1, limit = 20, status, sellerId, customerId }) => {
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const query = {};
  if (status) query.status = status;
  if (sellerId && mongoose.Types.ObjectId.isValid(sellerId)) query.seller = sellerId;
  if (customerId && mongoose.Types.ObjectId.isValid(customerId)) query.customer = customerId;

  const [returns, total] = await Promise.all([
    ReturnRequest.find(query)
      .populate('order', 'orderNumber orderStatus createdAt')
      .populate('seller', 'businessName')
      .populate('customer', 'fullName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum),
    ReturnRequest.countDocuments(query)
  ]);

  return {
    returns,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum)
  };
};

/**
 * Admin: Get single return request by ID.
 */
const getAdminReturnById = async (returnId) => {
  const returnReq = await ReturnRequest.findById(returnId)
    .populate('order', 'orderNumber orderStatus grandTotal payment createdAt')
    .populate('seller', 'businessName')
    .populate('customer', 'fullName email');

  if (!returnReq) {
    throw new ApiError(404, 'Return request not found');
  }

  return returnReq;
};

/**
 * Admin: Approve return request.
 */
const approveAdminReturn = async (adminUserId, returnId) => {
  const returnReq = await ReturnRequest.findById(returnId);
  if (!returnReq) {
    throw new ApiError(404, 'Return request not found');
  }

  validateStatusTransition(returnReq.status, 'approved');

  returnReq.status = 'approved';
  returnReq.reviewedAt = new Date();
  returnReq.reviewedBy = adminUserId;

  if (!returnReq.stockRestored) {
    const inventoryService = require('./inventoryService');
    for (const item of returnReq.items) {
      const updatedProduct = await Product.findOneAndUpdate(
        { _id: item.product },
        { $inc: { stock: item.quantity } },
        { new: true }
      );
      if (updatedProduct) {
        await inventoryService.recordMovement({
          product: item.product,
          seller: item.seller,
          type: 'RETURN_RESTORED',
          quantity: item.quantity,
          previousStock: updatedProduct.stock - item.quantity,
          newStock: updatedProduct.stock,
          reason: `Admin Return approved: ${returnReq._id}`,
          referenceType: 'ReturnRequest',
          referenceId: returnReq._id,
          performedBy: adminUserId
        });
      }
    }
    returnReq.stockRestored = true;
  }

  await returnReq.save();

  // ── POST-DB: Admin approve notifications (fire-and-forget) ──
  const adminApproveRef = returnReq;
  setImmediate(async () => {
    try {
      const orderDoc = await Order.findById(adminApproveRef.order).select('orderNumber').lean();
      const orderNumber = orderDoc?.orderNumber || 'N/A';
      const customerUserId = adminApproveRef.customer?.toString();
      if (customerUserId) {
        await notificationService.notifyReturnApproved({
          returnRequest: adminApproveRef,
          customerUserId,
          orderNumber
        });
        const customerUser = await User.findById(customerUserId).select('name email').lean();
        if (customerUser?.email) {
          await emailService.sendReturnApprovedEmail({
            toEmail: customerUser.email,
            userName: customerUser.name,
            orderNumber,
            refundAmount: adminApproveRef.refundAmount
          });
        }
      }
    } catch (notifErr) {
      console.error('[ReturnService] Admin post-approve notification error (non-critical):', notifErr.message);
    }
  });

  return returnReq;
};

/**
 * Admin: Reject return request.
 */
const rejectAdminReturn = async (adminUserId, returnId, rejectionReason) => {
  const returnReq = await ReturnRequest.findById(returnId);
  if (!returnReq) {
    throw new ApiError(404, 'Return request not found');
  }

  validateStatusTransition(returnReq.status, 'rejected');

  returnReq.status = 'rejected';
  returnReq.rejectionReason = rejectionReason.trim();
  returnReq.reviewedAt = new Date();
  returnReq.reviewedBy = adminUserId;

  await returnReq.save();

  // ── POST-DB: Admin reject notifications (fire-and-forget) ──
  const adminRejectRef = returnReq;
  setImmediate(async () => {
    try {
      const orderDoc = await Order.findById(adminRejectRef.order).select('orderNumber').lean();
      const orderNumber = orderDoc?.orderNumber || 'N/A';
      const customerUserId = adminRejectRef.customer?.toString();
      if (customerUserId) {
        await notificationService.notifyReturnRejected({
          returnRequest: adminRejectRef,
          customerUserId,
          orderNumber
        });
        const customerUser = await User.findById(customerUserId).select('name email').lean();
        if (customerUser?.email) {
          await emailService.sendReturnRejectedEmail({
            toEmail: customerUser.email,
            userName: customerUser.name,
            orderNumber,
            rejectionReason: adminRejectRef.rejectionReason
          });
        }
      }
    } catch (notifErr) {
      console.error('[ReturnService] Admin post-reject notification error (non-critical):', notifErr.message);
    }
  });

  return returnReq;
};

/**
 * Admin: Process refund for return request.
 * Idempotent: Skips duplicate stock restoration or duplicate refunds.
 */
const processRefund = async (adminUserId, returnId) => {
  const returnReq = await ReturnRequest.findById(returnId);
  if (!returnReq) {
    throw new ApiError(404, 'Return request not found');
  }

  // Idempotency: If already refunded, return existing state cleanly
  if (returnReq.status === 'refunded' && returnReq.refundStatus === 'processed') {
    return {
      message: 'Refund has already been processed',
      returnRequest: returnReq
    };
  }

  validateStatusTransition(returnReq.status, 'refunded');

  const order = await Order.findById(returnReq.order);
  if (!order) {
    throw new ApiError(404, 'Associated order not found');
  }

  // Restore stock if not already restored upon approval
  if (!returnReq.stockRestored) {
    const inventoryService = require('./inventoryService');
    for (const item of returnReq.items) {
      const updatedProduct = await Product.findOneAndUpdate(
        { _id: item.product },
        { $inc: { stock: item.quantity } },
        { new: true }
      );
      if (updatedProduct) {
        await inventoryService.recordMovement({
          product: item.product,
          seller: item.seller,
          type: 'RETURN_RESTORED',
          quantity: item.quantity,
          previousStock: updatedProduct.stock - item.quantity,
          newStock: updatedProduct.stock,
          reason: `Admin Refund issued: ${returnReq._id}`,
          referenceType: 'ReturnRequest',
          referenceId: returnReq._id,
          performedBy: adminUserId
        });
      }
    }
    returnReq.stockRestored = true;
  }

  // Trigger Razorpay refund if payment ID exists
  let razorpayRefundId = null;
  if (order.payment?.razorpayPaymentId) {
    const refundResult = await razorpayService.refundPayment({
      paymentId: order.payment.razorpayPaymentId,
      amountPaise: toPaise(returnReq.refundAmount),
      notes: {
        returnId: returnReq._id.toString(),
        orderId: order._id.toString()
      }
    });
    razorpayRefundId = refundResult.id;
  }

  // Debit the refund amount from the seller's wallet
  await sellerWalletService.debitRefundAmount(
    order._id,
    returnReq.seller,
    returnReq.refundAmount,
    returnReq._id
  );

  returnReq.status = 'refunded';
  returnReq.refundStatus = 'processed';
  returnReq.refundedAt = new Date();
  if (razorpayRefundId) {
    returnReq.razorpayRefundId = razorpayRefundId;
  }

  await returnReq.save();

  // ── POST-DB: Refund completion notifications (fire-and-forget) ──
  const refundedRef = returnReq;
  const orderRef = order;
  setImmediate(async () => {
    try {
      const customerUserId = refundedRef.customer?.toString();
      if (customerUserId) {
        // REFUND_INITIATED fires when Razorpay is in mock mode or real mode
        await notificationService.notifyRefundInitiated({
          returnRequest: refundedRef,
          customerUserId,
          orderNumber: orderRef.orderNumber
        });
        // REFUND_COMPLETED fires after the DB is successfully updated to 'refunded'
        await notificationService.notifyRefundCompleted({
          returnRequest: refundedRef,
          customerUserId,
          orderNumber: orderRef.orderNumber
        });
        const customerUser = await User.findById(customerUserId).select('name email').lean();
        if (customerUser?.email) {
          await emailService.sendRefundInitiatedEmail({
            toEmail: customerUser.email,
            userName: customerUser.name,
            orderNumber: orderRef.orderNumber,
            refundAmount: refundedRef.refundAmount
          });
          await emailService.sendRefundCompletedEmail({
            toEmail: customerUser.email,
            userName: customerUser.name,
            orderNumber: orderRef.orderNumber,
            refundAmount: refundedRef.refundAmount
          });
        }
      }
    } catch (notifErr) {
      console.error('[ReturnService] Post-refund notification error (non-critical):', notifErr.message);
    }
  });

  return {
    message: 'Refund processed successfully',
    returnRequest: returnReq
  };
};

module.exports = {
  cancelOrder,
  createReturnRequest,
  getCustomerReturns,
  getCustomerReturnById,
  getSellerReturns,
  getSellerReturnById,
  approveSellerReturn,
  rejectSellerReturn,
  getAdminReturns,
  getAdminReturnById,
  approveAdminReturn,
  rejectAdminReturn,
  processRefund
};
