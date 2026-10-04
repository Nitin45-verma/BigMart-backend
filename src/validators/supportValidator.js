const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');
const { TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES } = require('../models/SupportTicket');
const { VALID_ATTACHMENT_TYPES, MAX_ATTACHMENT_SIZE, MAX_ATTACHMENTS_PER_MESSAGE } = require('../models/SupportMessage');

/**
 * Fields that must never be set by the client directly.
 * These are server-generated or admin-only fields.
 */
const PROTECTED_TICKET_FIELDS = [
  'createdBy', 'requesterRole', 'assignedAdmin', 'escalated',
  'escalationReason', 'resolvedAt', 'closedAt', 'ticketNumber',
  'status', 'lastMessageAt'
];

const PROTECTED_MESSAGE_FIELDS = [
  'sender', 'senderRole', 'isInternal', 'ticket'
];

/**
 * Strips protected fields from body and returns 400 if any are found.
 */
const blockProtectedFields = (fields) => (req, res, next) => {
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      return next(new ApiError(400, `Setting '${field}' is not permitted`));
    }
  }
  next();
};

/**
 * Validates ticket creation input.
 */
const validateCreateTicket = [
  blockProtectedFields(PROTECTED_TICKET_FIELDS),
  (req, res, next) => {
    const { subject, description, category, priority, order, product, returnRequest, payout } = req.body;

    if (!subject || typeof subject !== 'string' || subject.trim().length < 5) {
      return next(new ApiError(400, 'Subject must be at least 5 characters'));
    }
    if (subject.trim().length > 200) {
      return next(new ApiError(400, 'Subject cannot exceed 200 characters'));
    }

    if (!description || typeof description !== 'string' || description.trim().length < 10) {
      return next(new ApiError(400, 'Description must be at least 10 characters'));
    }
    if (description.trim().length > 5000) {
      return next(new ApiError(400, 'Description cannot exceed 5000 characters'));
    }

    if (!category || !TICKET_CATEGORIES.includes(category)) {
      return next(new ApiError(400, `Invalid category. Allowed: ${TICKET_CATEGORIES.join(', ')}`));
    }

    if (priority !== undefined && !TICKET_PRIORITIES.includes(priority)) {
      return next(new ApiError(400, `Invalid priority. Allowed: ${TICKET_PRIORITIES.join(', ')}`));
    }

    if (order !== undefined && !mongoose.Types.ObjectId.isValid(order)) {
      return next(new ApiError(400, 'Invalid order ID'));
    }
    if (product !== undefined && !mongoose.Types.ObjectId.isValid(product)) {
      return next(new ApiError(400, 'Invalid product ID'));
    }
    if (returnRequest !== undefined && !mongoose.Types.ObjectId.isValid(returnRequest)) {
      return next(new ApiError(400, 'Invalid returnRequest ID'));
    }
    if (payout !== undefined && !mongoose.Types.ObjectId.isValid(payout)) {
      return next(new ApiError(400, 'Invalid payout ID'));
    }

    next();
  }
];

/**
 * Validates ticket ID param as a valid ObjectId.
 */
const validateTicketId = (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.ticketId)) {
    return next(new ApiError(400, 'Invalid ticket ID'));
  }
  next();
};

/**
 * Validates message creation input.
 */
const validateAddMessage = [
  blockProtectedFields(PROTECTED_MESSAGE_FIELDS),
  (req, res, next) => {
    const { message, attachments } = req.body;

    const msg = message && typeof message === 'string' ? message.trim() : '';
    const atts = Array.isArray(attachments) ? attachments : [];

    if (!msg && atts.length === 0) {
      return next(new ApiError(400, 'Message text or at least one attachment is required'));
    }
    if (msg.length > 5000) {
      return next(new ApiError(400, 'Message cannot exceed 5000 characters'));
    }
    if (atts.length > MAX_ATTACHMENTS_PER_MESSAGE) {
      return next(new ApiError(400, `Maximum ${MAX_ATTACHMENTS_PER_MESSAGE} attachments per message`));
    }
    for (const att of atts) {
      if (!att.fileId || !att.url || !att.fileName || !att.mimeType || att.size === undefined) {
        return next(new ApiError(400, 'Each attachment must include: fileId, url, fileName, mimeType, size'));
      }
      if (!VALID_ATTACHMENT_TYPES.includes(att.mimeType)) {
        return next(new ApiError(400, `Unsupported file type: ${att.mimeType}. Allowed: image/jpeg, image/png, image/webp, application/pdf`));
      }
      if (typeof att.size !== 'number' || att.size > MAX_ATTACHMENT_SIZE) {
        return next(new ApiError(400, 'Attachment exceeds maximum 5MB limit'));
      }
    }
    next();
  }
];

/**
 * Validates status change input.
 */
const validateStatusChange = (req, res, next) => {
  const { status } = req.body;
  if (!status || !TICKET_STATUSES.includes(status)) {
    return next(new ApiError(400, `Invalid status. Allowed: ${TICKET_STATUSES.join(', ')}`));
  }
  next();
};

/**
 * Validates priority change input (admin only).
 */
const validatePriorityChange = (req, res, next) => {
  const { priority } = req.body;
  if (!priority || !TICKET_PRIORITIES.includes(priority)) {
    return next(new ApiError(400, `Invalid priority. Allowed: ${TICKET_PRIORITIES.join(', ')}`));
  }
  next();
};

/**
 * Validates assign ticket input (admin only).
 */
const validateAssignTicket = (req, res, next) => {
  const { adminUserId } = req.body;
  if (!adminUserId || !mongoose.Types.ObjectId.isValid(adminUserId)) {
    return next(new ApiError(400, 'Valid adminUserId is required'));
  }
  next();
};

/**
 * Validates escalation input (admin only).
 */
const validateEscalation = (req, res, next) => {
  const { escalationReason } = req.body;
  if (!escalationReason || typeof escalationReason !== 'string' || !escalationReason.trim()) {
    return next(new ApiError(400, 'escalationReason is required'));
  }
  next();
};

/**
 * Validates admin ticket list query params.
 */
const validateAdminListQuery = (req, res, next) => {
  const { page, limit, status, priority, category, requesterRole, assignedAdmin, startDate, endDate } = req.query;

  if (page !== undefined) {
    const p = parseInt(page, 10);
    if (isNaN(p) || p < 1) return next(new ApiError(400, 'page must be a positive integer'));
  }
  if (limit !== undefined) {
    const l = parseInt(limit, 10);
    if (isNaN(l) || l < 1 || l > 100) return next(new ApiError(400, 'limit must be between 1 and 100'));
  }
  if (status && !TICKET_STATUSES.includes(status)) {
    return next(new ApiError(400, `Invalid status filter. Allowed: ${TICKET_STATUSES.join(', ')}`));
  }
  if (priority && !TICKET_PRIORITIES.includes(priority)) {
    return next(new ApiError(400, `Invalid priority filter. Allowed: ${TICKET_PRIORITIES.join(', ')}`));
  }
  if (category && !TICKET_CATEGORIES.includes(category)) {
    return next(new ApiError(400, `Invalid category filter. Allowed: ${TICKET_CATEGORIES.join(', ')}`));
  }
  if (requesterRole && !['customer', 'seller', 'admin'].includes(requesterRole)) {
    return next(new ApiError(400, 'Invalid requesterRole filter'));
  }
  if (assignedAdmin && !mongoose.Types.ObjectId.isValid(assignedAdmin)) {
    return next(new ApiError(400, 'Invalid assignedAdmin ID'));
  }
  if (startDate && isNaN(new Date(startDate).getTime())) {
    return next(new ApiError(400, 'Invalid startDate'));
  }
  if (endDate && isNaN(new Date(endDate).getTime())) {
    return next(new ApiError(400, 'Invalid endDate'));
  }
  next();
};

module.exports = {
  validateCreateTicket,
  validateTicketId,
  validateAddMessage,
  validateStatusChange,
  validatePriorityChange,
  validateAssignTicket,
  validateEscalation,
  validateAdminListQuery
};
