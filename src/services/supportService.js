const mongoose = require('mongoose');
const SupportTicket = require('../models/SupportTicket');
const SupportMessage = require('../models/SupportMessage');
const { TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES, ALLOWED_STATUS_TRANSITIONS } = require('../models/SupportTicket');
const Order = require('../models/Order');
const Product = require('../models/Product');
const ReturnRequest = require('../models/ReturnRequest');
const SellerPayout = require('../models/SellerPayout');
const User = require('../models/User');
const Seller = require('../models/Seller');
const AdminAuditLog = require('../models/AdminAuditLog');
const notificationService = require('./notificationService');
const ApiError = require('../utils/ApiError');

// ============================================================
// TICKET NUMBER GENERATION
// ============================================================

/**
 * Generate a unique human-readable ticket number.
 * Format: BM-SUP-YYYYMMDD-NNNNNN
 * Uses a retry loop to handle concurrency collisions on the sequential number.
 */
const generateTicketNumber = async () => {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `BM-SUP-${dateStr}-`;

  // Find the last ticket with today's prefix
  const lastTicket = await SupportTicket.findOne(
    { ticketNumber: { $regex: `^${prefix}` } },
    { ticketNumber: 1 },
    { sort: { ticketNumber: -1 } }
  );

  let seq = 1;
  if (lastTicket) {
    const parts = lastTicket.ticketNumber.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }

  return `${prefix}${String(seq).padStart(6, '0')}`;
};

// ============================================================
// LINKED ENTITY VALIDATION
// ============================================================

/**
 * Validates that a linked order belongs to the requesting user (customer)
 * or contains items from the requesting seller.
 */
const validateOrderLink = async (orderId, userId, role) => {
  if (!orderId) return null;
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new ApiError(400, 'Invalid order ID');
  }
  const order = await Order.findById(orderId);
  if (!order) throw new ApiError(404, 'Order not found');

  if (role === 'customer') {
    if (order.user.toString() !== userId.toString()) {
      throw new ApiError(403, 'You cannot link this order — it does not belong to you');
    }
  } else if (role === 'seller') {
    const seller = await Seller.findOne({ user: userId });
    if (!seller) throw new ApiError(403, 'Seller profile not found');
    const hasItem = order.items.some(
      (item) => item.seller && item.seller.toString() === seller._id.toString()
    );
    if (!hasItem) {
      throw new ApiError(403, 'You cannot link this order — it does not contain your items');
    }
  }
  return order;
};

/**
 * Validates return request ownership.
 */
const validateReturnLink = async (returnRequestId, userId, role) => {
  if (!returnRequestId) return null;
  if (!mongoose.Types.ObjectId.isValid(returnRequestId)) {
    throw new ApiError(400, 'Invalid return request ID');
  }
  const ret = await ReturnRequest.findById(returnRequestId);
  if (!ret) throw new ApiError(404, 'Return request not found');

  if (role === 'customer') {
    if (ret.customer && ret.customer.toString() !== userId.toString()) {
      throw new ApiError(403, 'You cannot link this return request');
    }
  } else if (role === 'seller') {
    const seller = await Seller.findOne({ user: userId });
    if (!seller) throw new ApiError(403, 'Seller profile not found');
    if (ret.seller && ret.seller.toString() !== seller._id.toString()) {
      throw new ApiError(403, 'You cannot link this return request');
    }
  }
  return ret;
};

/**
 * Validates payout ownership for sellers.
 */
const validatePayoutLink = async (payoutId, userId, role) => {
  if (!payoutId) return null;
  if (!mongoose.Types.ObjectId.isValid(payoutId)) {
    throw new ApiError(400, 'Invalid payout ID');
  }
  const payout = await SellerPayout.findById(payoutId);
  if (!payout) throw new ApiError(404, 'Payout not found');

  if (role === 'seller') {
    const seller = await Seller.findOne({ user: userId });
    if (!seller) throw new ApiError(403, 'Seller profile not found');
    if (payout.seller.toString() !== seller._id.toString()) {
      throw new ApiError(403, 'You cannot link this payout');
    }
  }
  return payout;
};

// ============================================================
// CREATE TICKET
// ============================================================

const createTicket = async ({
  userId,
  role,
  subject,
  description,
  category,
  priority,
  orderId,
  productId,
  returnRequestId,
  payoutId,
  paymentReference
}) => {
  // Validate category and priority
  if (!TICKET_CATEGORIES.includes(category)) {
    throw new ApiError(400, `Invalid category. Allowed: ${TICKET_CATEGORIES.join(', ')}`);
  }
  if (priority && !TICKET_PRIORITIES.includes(priority)) {
    throw new ApiError(400, `Invalid priority. Allowed: ${TICKET_PRIORITIES.join(', ')}`);
  }
  // Non-admins cannot set URGENT directly
  if (role !== 'admin' && priority === 'URGENT') {
    throw new ApiError(403, 'Only admins can set URGENT priority directly');
  }

  // Validate linked entities
  await validateOrderLink(orderId, userId, role);
  await validateReturnLink(returnRequestId, userId, role);
  await validatePayoutLink(payoutId, userId, role);

  if (productId && !mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(400, 'Invalid product ID');
  }

  // Generate unique ticket number with retry for concurrency
  let ticketNumber;
  let attempts = 0;
  let ticket;

  while (attempts < 5) {
    ticketNumber = await generateTicketNumber();
    
    try {
      ticket = await SupportTicket.create({
        ticketNumber,
        createdBy: userId,
        requesterRole: role,
        subject: subject.trim(),
        description: description.trim(),
        category,
        priority: priority || 'MEDIUM',
        status: 'OPEN',
        order: orderId || null,
        product: productId || null,
        returnRequest: returnRequestId || null,
        payout: payoutId || null,
        paymentReference: paymentReference || null
      });
      break; // Success
    } catch (err) {
      if (err.code === 11000 && err.keyPattern && err.keyPattern.ticketNumber) {
        attempts++;
        await new Promise((r) => setTimeout(r, 100)); // wait and retry
      } else {
        throw err;
      }
    }
  }

  if (!ticket) {
    throw new ApiError(500, 'Failed to generate unique ticket number. Please try again.');
  }

  // Notify — fire and forget
  setImmediate(async () => {
    try {
      await notificationService.createNotification({
        recipient: userId,
        recipientRole: role,
        type: 'SUPPORT_TICKET_CREATED',
        title: 'Support Ticket Created',
        message: `Your support ticket #${ticketNumber} has been received. We will get back to you shortly.`,
        data: { ticketId: ticket._id.toString(), ticketNumber },
        eventKey: `SUPPORT_TICKET_CREATED:${ticket._id}:${userId}`
      });
    } catch (_) {}
  });

  return ticket;
};

// ============================================================
// LIST TICKETS
// ============================================================

const listTickets = async ({ userId, role, query }) => {
  const {
    status, priority, category, page = 1, limit = 20,
    sortBy = 'createdAt', sortOrder = 'desc'
  } = query;

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  // Ownership enforcement — non-admins see only their own tickets
  const filter = role === 'admin' ? {} : { createdBy: userId };

  if (status) {
    if (!TICKET_STATUSES.includes(status)) throw new ApiError(400, 'Invalid status filter');
    filter.status = status;
  }
  if (priority) {
    if (!TICKET_PRIORITIES.includes(priority)) throw new ApiError(400, 'Invalid priority filter');
    filter.priority = priority;
  }
  if (category) {
    if (!TICKET_CATEGORIES.includes(category)) throw new ApiError(400, 'Invalid category filter');
    filter.category = category;
  }

  const ALLOWED_SORT_FIELDS = ['createdAt', 'updatedAt', 'lastMessageAt', 'priority', 'status'];
  const sortField = ALLOWED_SORT_FIELDS.includes(sortBy) ? sortBy : 'createdAt';
  const sortDir = sortOrder === 'asc' ? 1 : -1;

  const [tickets, total] = await Promise.all([
    SupportTicket.find(filter)
      .select('-__v')
      .sort({ [sortField]: sortDir })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    SupportTicket.countDocuments(filter)
  ]);

  return {
    tickets,
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) }
  };
};

// ============================================================
// ADMIN LIST TICKETS (with full filter support)
// ============================================================

const adminListTickets = async ({ query }) => {
  const {
    status, priority, category, requesterRole,
    assignedAdmin, escalated, search,
    startDate, endDate, page = 1, limit = 20,
    sortBy = 'createdAt', sortOrder = 'desc'
  } = query;

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const filter = {};

  if (status) {
    if (!TICKET_STATUSES.includes(status)) throw new ApiError(400, 'Invalid status filter');
    filter.status = status;
  }
  if (priority) {
    if (!TICKET_PRIORITIES.includes(priority)) throw new ApiError(400, 'Invalid priority filter');
    filter.priority = priority;
  }
  if (category) {
    if (!TICKET_CATEGORIES.includes(category)) throw new ApiError(400, 'Invalid category filter');
    filter.category = category;
  }
  if (requesterRole) {
    if (!['customer', 'seller', 'admin'].includes(requesterRole)) throw new ApiError(400, 'Invalid requesterRole filter');
    filter.requesterRole = requesterRole;
  }
  if (assignedAdmin) {
    if (!mongoose.Types.ObjectId.isValid(assignedAdmin)) throw new ApiError(400, 'Invalid assignedAdmin ID');
    filter.assignedAdmin = assignedAdmin;
  }
  if (escalated !== undefined) {
    filter.escalated = escalated === 'true' || escalated === true;
  }
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) {
      const d = new Date(startDate);
      if (isNaN(d.getTime())) throw new ApiError(400, 'Invalid startDate');
      filter.createdAt.$gte = d;
    }
    if (endDate) {
      const d = new Date(endDate);
      if (isNaN(d.getTime())) throw new ApiError(400, 'Invalid endDate');
      filter.createdAt.$lte = d;
    }
  }
  if (search && typeof search === 'string' && search.trim().length > 0) {
    const safeSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { ticketNumber: { $regex: safeSearch, $options: 'i' } },
      { subject: { $regex: safeSearch, $options: 'i' } }
    ];
  }

  const ALLOWED_SORT_FIELDS = ['createdAt', 'updatedAt', 'lastMessageAt', 'priority', 'status'];
  const sortField = ALLOWED_SORT_FIELDS.includes(sortBy) ? sortBy : 'createdAt';
  const sortDir = sortOrder === 'asc' ? 1 : -1;

  const [tickets, total] = await Promise.all([
    SupportTicket.find(filter)
      .select('-__v')
      .populate('createdBy', 'name email role')
      .populate('assignedAdmin', 'name email')
      .sort({ [sortField]: sortDir })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    SupportTicket.countDocuments(filter)
  ]);

  return {
    tickets,
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) }
  };
};

// ============================================================
// GET SINGLE TICKET
// ============================================================

const getTicket = async ({ ticketId, userId, role }) => {
  if (!mongoose.Types.ObjectId.isValid(ticketId)) {
    throw new ApiError(400, 'Invalid ticket ID');
  }

  const filter = { _id: ticketId };
  if (role !== 'admin') filter.createdBy = userId; // Ownership enforcement

  const ticket = await SupportTicket.findOne(filter)
    .populate('createdBy', 'name email role')
    .populate('assignedAdmin', 'name email')
    .select('-__v');

  if (!ticket) throw new ApiError(404, 'Ticket not found or access denied');
  return ticket;
};

// ============================================================
// GET TICKET MESSAGES
// ============================================================

const getTicketMessages = async ({ ticketId, userId, role }) => {
  if (!mongoose.Types.ObjectId.isValid(ticketId)) {
    throw new ApiError(400, 'Invalid ticket ID');
  }

  // Verify ticket access first
  await getTicket({ ticketId, userId, role });

  const messageFilter = { ticket: ticketId };
  // Non-admins must not see internal notes
  if (role !== 'admin') {
    messageFilter.isInternal = false;
  }

  const messages = await SupportMessage.find(messageFilter)
    .populate('sender', 'name email role')
    .select('-__v')
    .sort({ createdAt: 1 });

  return messages;
};

// ============================================================
// ADD MESSAGE
// ============================================================

const addMessage = async ({
  ticketId,
  senderId,
  senderRole,
  message,
  attachments = [],
  isInternal = false
}) => {
  if (!mongoose.Types.ObjectId.isValid(ticketId)) {
    throw new ApiError(400, 'Invalid ticket ID');
  }

  const ticket = await SupportTicket.findOne(
    senderRole === 'admin'
      ? { _id: ticketId }
      : { _id: ticketId, createdBy: senderId }
  );
  if (!ticket) throw new ApiError(404, 'Ticket not found or access denied');

  if (ticket.status === 'CLOSED') {
    throw new ApiError(422, 'Cannot add message to a closed ticket');
  }

  // Security: non-admins cannot create internal notes
  const safeIsInternal = senderRole === 'admin' ? Boolean(isInternal) : false;

  const msg = message && typeof message === 'string' ? message.trim() : '';
  if (!msg && attachments.length === 0) {
    throw new ApiError(400, 'Message text or at least one attachment is required');
  }
  if (msg.length > 5000) {
    throw new ApiError(400, 'Message cannot exceed 5000 characters');
  }

  // Validate attachments
  if (attachments.length > SupportMessage.MAX_ATTACHMENTS_PER_MESSAGE) {
    throw new ApiError(400, `Maximum ${SupportMessage.MAX_ATTACHMENTS_PER_MESSAGE} attachments allowed`);
  }
  for (const att of attachments) {
    if (!SupportMessage.VALID_ATTACHMENT_TYPES.includes(att.mimeType)) {
      throw new ApiError(400, `Unsupported file type: ${att.mimeType}. Allowed: jpg, jpeg, png, webp, pdf`);
    }
    if (att.size > SupportMessage.MAX_ATTACHMENT_SIZE) {
      throw new ApiError(400, 'Attachment exceeds maximum size of 5MB');
    }
  }

  const newMsg = await SupportMessage.create({
    ticket: ticketId,
    sender: senderId,
    senderRole,
    message: msg || '',
    attachments,
    isInternal: safeIsInternal
  });

  // Update lastMessageAt on ticket
  ticket.lastMessageAt = new Date();
  await ticket.save();

  // Notify ticket owner of reply (only for public messages, exclude sender)
  if (!safeIsInternal && senderId.toString() !== ticket.createdBy.toString()) {
    setImmediate(async () => {
      try {
        await notificationService.createNotification({
          recipient: ticket.createdBy,
          recipientRole: ticket.requesterRole,
          type: 'SUPPORT_TICKET_REPLY',
          title: 'New Reply on Your Support Ticket',
          message: `There is a new reply on your support ticket #${ticket.ticketNumber}.`,
          data: { ticketId: ticket._id.toString(), ticketNumber: ticket.ticketNumber },
          eventKey: `SUPPORT_TICKET_REPLY:${newMsg._id}:${ticket.createdBy}`
        });
      } catch (_) {}
    });
  }

  return newMsg;
};

// ============================================================
// STATUS TRANSITION
// ============================================================

const changeStatus = async ({ ticketId, userId, role, newStatus, adminId }) => {
  if (!mongoose.Types.ObjectId.isValid(ticketId)) {
    throw new ApiError(400, 'Invalid ticket ID');
  }
  if (!TICKET_STATUSES.includes(newStatus)) {
    throw new ApiError(400, `Invalid status. Allowed: ${TICKET_STATUSES.join(', ')}`);
  }

  const filter = role === 'admin' ? { _id: ticketId } : { _id: ticketId, createdBy: userId };
  const ticket = await SupportTicket.findOne(filter);
  if (!ticket) throw new ApiError(404, 'Ticket not found or access denied');

  const allowed = ALLOWED_STATUS_TRANSITIONS[ticket.status] || [];
  if (!allowed.includes(newStatus)) {
    throw new ApiError(
      422,
      `Cannot transition ticket from '${ticket.status}' to '${newStatus}'`
    );
  }

  // Non-admins have restricted transitions
  if (role !== 'admin') {
    const customerAllowed = ['CLOSED']; // Customer can close RESOLVED tickets
    if (!customerAllowed.includes(newStatus)) {
      throw new ApiError(403, 'You are not permitted to perform this status transition');
    }
    if (ticket.status !== 'RESOLVED') {
      throw new ApiError(422, 'You can only close a resolved ticket');
    }
  }

  ticket.status = newStatus;
  if (newStatus === 'RESOLVED') ticket.resolvedAt = new Date();
  if (newStatus === 'CLOSED') ticket.closedAt = new Date();

  await ticket.save();

  // Audit for admins
  if (role === 'admin' && adminId) {
    setImmediate(async () => {
      try {
        await AdminAuditLog.create({
          admin: adminId,
          action: 'SUPPORT_TICKET_STATUS_CHANGE',
          targetType: 'SupportTicket',
          targetId: ticket._id,
          metadata: { ticketNumber: ticket.ticketNumber, oldStatus: allowed[0], newStatus },
          ipAddress: null
        });
      } catch (_) {}
    });
  }

  return ticket;
};

// ============================================================
// ADMIN: CHANGE PRIORITY
// ============================================================

const changePriority = async ({ ticketId, adminId, newPriority }) => {
  if (!mongoose.Types.ObjectId.isValid(ticketId)) throw new ApiError(400, 'Invalid ticket ID');
  if (!TICKET_PRIORITIES.includes(newPriority)) {
    throw new ApiError(400, `Invalid priority. Allowed: ${TICKET_PRIORITIES.join(', ')}`);
  }

  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) throw new ApiError(404, 'Ticket not found');

  const oldPriority = ticket.priority;
  ticket.priority = newPriority;
  await ticket.save();

  setImmediate(async () => {
    try {
      await AdminAuditLog.create({
        admin: adminId,
        action: 'SUPPORT_TICKET_PRIORITY_CHANGE',
        targetType: 'SupportTicket',
        targetId: ticket._id,
        metadata: { ticketNumber: ticket.ticketNumber, oldPriority, newPriority }
      });
    } catch (_) {}
  });

  return ticket;
};

// ============================================================
// ADMIN: ASSIGN
// ============================================================

const assignTicket = async ({ ticketId, adminId, assignToUserId }) => {
  if (!mongoose.Types.ObjectId.isValid(ticketId)) throw new ApiError(400, 'Invalid ticket ID');
  if (!mongoose.Types.ObjectId.isValid(assignToUserId)) throw new ApiError(400, 'Invalid admin user ID');

  const assignee = await User.findById(assignToUserId);
  if (!assignee) throw new ApiError(404, 'User not found');
  if (assignee.role !== 'admin') throw new ApiError(422, 'Can only assign tickets to admin users');
  if (assignee.isBlocked) throw new ApiError(422, 'Cannot assign ticket to a blocked user');

  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) throw new ApiError(404, 'Ticket not found');

  ticket.assignedAdmin = assignToUserId;
  await ticket.save();

  setImmediate(async () => {
    try {
      await AdminAuditLog.create({
        admin: adminId,
        action: 'SUPPORT_TICKET_ASSIGNED',
        targetType: 'SupportTicket',
        targetId: ticket._id,
        metadata: { ticketNumber: ticket.ticketNumber, assignedTo: assignToUserId }
      });
      // Notify the assigned admin
      await notificationService.createNotification({
        recipient: assignToUserId,
        recipientRole: 'admin',
        type: 'SUPPORT_TICKET_ASSIGNED',
        title: 'Ticket Assigned to You',
        message: `Support ticket #${ticket.ticketNumber} has been assigned to you.`,
        data: { ticketId: ticket._id.toString(), ticketNumber: ticket.ticketNumber },
        eventKey: `SUPPORT_TICKET_ASSIGNED:${ticket._id}:${assignToUserId}`
      });
    } catch (_) {}
  });

  return ticket;
};

// ============================================================
// ADMIN: ESCALATE
// ============================================================

const escalateTicket = async ({ ticketId, adminId, escalationReason }) => {
  if (!mongoose.Types.ObjectId.isValid(ticketId)) throw new ApiError(400, 'Invalid ticket ID');
  if (!escalationReason || !escalationReason.trim()) {
    throw new ApiError(400, 'Escalation reason is required');
  }

  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) throw new ApiError(404, 'Ticket not found');
  if (ticket.status === 'CLOSED') throw new ApiError(422, 'Cannot escalate a closed ticket');

  ticket.escalated = true;
  ticket.escalationReason = escalationReason.trim();
  ticket.status = 'ESCALATED';
  await ticket.save();

  setImmediate(async () => {
    try {
      await AdminAuditLog.create({
        admin: adminId,
        action: 'SUPPORT_TICKET_ESCALATED',
        targetType: 'SupportTicket',
        targetId: ticket._id,
        metadata: { ticketNumber: ticket.ticketNumber, escalationReason: escalationReason.trim() }
      });
      // Notify ticket owner
      await notificationService.createNotification({
        recipient: ticket.createdBy,
        recipientRole: ticket.requesterRole,
        type: 'SUPPORT_TICKET_ESCALATED',
        title: 'Your Ticket Has Been Escalated',
        message: `Your support ticket #${ticket.ticketNumber} has been escalated for priority review.`,
        data: { ticketId: ticket._id.toString(), ticketNumber: ticket.ticketNumber },
        eventKey: `SUPPORT_TICKET_ESCALATED:${ticket._id}:${ticket.createdBy}`
      });
    } catch (_) {}
  });

  return ticket;
};

// ============================================================
// ADMIN: RESOLVE
// ============================================================

const resolveTicket = async ({ ticketId, adminId }) => {
  if (!mongoose.Types.ObjectId.isValid(ticketId)) throw new ApiError(400, 'Invalid ticket ID');

  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) throw new ApiError(404, 'Ticket not found');

  const allowed = ALLOWED_STATUS_TRANSITIONS[ticket.status] || [];
  if (!allowed.includes('RESOLVED')) {
    throw new ApiError(422, `Cannot resolve a ticket with status '${ticket.status}'`);
  }

  ticket.status = 'RESOLVED';
  ticket.resolvedAt = new Date();
  await ticket.save();

  setImmediate(async () => {
    try {
      await AdminAuditLog.create({
        admin: adminId,
        action: 'SUPPORT_TICKET_RESOLVED',
        targetType: 'SupportTicket',
        targetId: ticket._id,
        metadata: { ticketNumber: ticket.ticketNumber }
      });
      await notificationService.createNotification({
        recipient: ticket.createdBy,
        recipientRole: ticket.requesterRole,
        type: 'SUPPORT_TICKET_RESOLVED',
        title: 'Your Support Ticket Has Been Resolved',
        message: `Your support ticket #${ticket.ticketNumber} has been resolved. If you have further concerns, please let us know.`,
        data: { ticketId: ticket._id.toString(), ticketNumber: ticket.ticketNumber },
        eventKey: `SUPPORT_TICKET_RESOLVED:${ticket._id}:${ticket.createdBy}`
      });
    } catch (_) {}
  });

  return ticket;
};

// ============================================================
// ADMIN: CLOSE
// ============================================================

const closeTicket = async ({ ticketId, adminId }) => {
  if (!mongoose.Types.ObjectId.isValid(ticketId)) throw new ApiError(400, 'Invalid ticket ID');

  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) throw new ApiError(404, 'Ticket not found');

  if (ticket.status !== 'RESOLVED') {
    throw new ApiError(422, 'Only RESOLVED tickets can be closed');
  }

  ticket.status = 'CLOSED';
  ticket.closedAt = new Date();
  await ticket.save();

  setImmediate(async () => {
    try {
      await AdminAuditLog.create({
        admin: adminId,
        action: 'SUPPORT_TICKET_CLOSED',
        targetType: 'SupportTicket',
        targetId: ticket._id,
        metadata: { ticketNumber: ticket.ticketNumber }
      });
      await notificationService.createNotification({
        recipient: ticket.createdBy,
        recipientRole: ticket.requesterRole,
        type: 'SUPPORT_TICKET_CLOSED',
        title: 'Your Support Ticket Has Been Closed',
        message: `Your support ticket #${ticket.ticketNumber} has been closed. Thank you for reaching out to BigMart support.`,
        data: { ticketId: ticket._id.toString(), ticketNumber: ticket.ticketNumber },
        eventKey: `SUPPORT_TICKET_CLOSED:${ticket._id}:${ticket.createdBy}`
      });
    } catch (_) {}
  });

  return ticket;
};

// ============================================================
// ADMIN: STATS
// ============================================================

const getSupportStats = async () => {
  const [statusCounts, categoryCounts, roleCounts] = await Promise.all([
    SupportTicket.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    SupportTicket.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]),
    SupportTicket.aggregate([
      { $group: { _id: '$requesterRole', count: { $sum: 1 } } }
    ])
  ]);

  const statusMap = {};
  statusCounts.forEach(({ _id, count }) => { statusMap[_id] = count; });

  const categoryMap = {};
  categoryCounts.forEach(({ _id, count }) => { categoryMap[_id] = count; });

  const roleMap = {};
  roleCounts.forEach(({ _id, count }) => { roleMap[_id] = count; });

  const [urgent, unassigned, total] = await Promise.all([
    SupportTicket.countDocuments({ priority: 'URGENT' }),
    SupportTicket.countDocuments({ assignedAdmin: null }),
    SupportTicket.countDocuments()
  ]);

  return {
    total,
    byStatus: {
      OPEN: statusMap.OPEN || 0,
      IN_PROGRESS: statusMap.IN_PROGRESS || 0,
      WAITING_FOR_CUSTOMER: statusMap.WAITING_FOR_CUSTOMER || 0,
      WAITING_FOR_SELLER: statusMap.WAITING_FOR_SELLER || 0,
      ESCALATED: statusMap.ESCALATED || 0,
      RESOLVED: statusMap.RESOLVED || 0,
      CLOSED: statusMap.CLOSED || 0
    },
    urgent,
    unassigned,
    byCategory: categoryMap,
    byRequesterRole: roleMap
  };
};

module.exports = {
  createTicket,
  listTickets,
  adminListTickets,
  getTicket,
  getTicketMessages,
  addMessage,
  changeStatus,
  changePriority,
  assignTicket,
  escalateTicket,
  resolveTicket,
  closeTicket,
  getSupportStats
};
