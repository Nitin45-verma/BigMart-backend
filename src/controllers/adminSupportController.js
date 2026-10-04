const supportService = require('../services/supportService');
const ApiError = require('../utils/ApiError');

/**
 * GET /api/v1/admin/support/tickets
 */
const listTickets = async (req, res, next) => {
  try {
    const result = await supportService.adminListTickets({ query: req.query });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/admin/support/tickets/:ticketId
 */
const getTicket = async (req, res, next) => {
  try {
    const ticket = await supportService.getTicket({
      ticketId: req.params.ticketId,
      userId: req.user.userId,
      role: 'admin'
    });
    const messages = await supportService.getTicketMessages({
      ticketId: req.params.ticketId,
      userId: req.user.userId,
      role: 'admin'
    });
    res.json({ success: true, ticket, messages });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/admin/support/tickets/:ticketId/messages
 * Admin sends public reply or internal note.
 */
const addMessage = async (req, res, next) => {
  try {
    const { message, attachments, isInternal } = req.body;
    const msg = await supportService.addMessage({
      ticketId: req.params.ticketId,
      senderId: req.user.userId,
      senderRole: 'admin',
      message,
      attachments: Array.isArray(attachments) ? attachments : [],
      isInternal: Boolean(isInternal)
    });
    res.status(201).json({ success: true, message: msg });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v1/admin/support/tickets/:ticketId/status
 */
const changeStatus = async (req, res, next) => {
  try {
    const ticket = await supportService.changeStatus({
      ticketId: req.params.ticketId,
      userId: req.user.userId,
      role: 'admin',
      newStatus: req.body.status,
      adminId: req.user.userId
    });
    res.json({ success: true, ticket });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v1/admin/support/tickets/:ticketId/priority
 */
const changePriority = async (req, res, next) => {
  try {
    const ticket = await supportService.changePriority({
      ticketId: req.params.ticketId,
      adminId: req.user.userId,
      newPriority: req.body.priority
    });
    res.json({ success: true, ticket });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v1/admin/support/tickets/:ticketId/assign
 */
const assignTicket = async (req, res, next) => {
  try {
    const ticket = await supportService.assignTicket({
      ticketId: req.params.ticketId,
      adminId: req.user.userId,
      assignToUserId: req.body.adminUserId
    });
    res.json({ success: true, ticket });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v1/admin/support/tickets/:ticketId/escalate
 */
const escalateTicket = async (req, res, next) => {
  try {
    const ticket = await supportService.escalateTicket({
      ticketId: req.params.ticketId,
      adminId: req.user.userId,
      escalationReason: req.body.escalationReason
    });
    res.json({ success: true, ticket });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v1/admin/support/tickets/:ticketId/resolve
 */
const resolveTicket = async (req, res, next) => {
  try {
    const ticket = await supportService.resolveTicket({
      ticketId: req.params.ticketId,
      adminId: req.user.userId
    });
    res.json({ success: true, ticket });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v1/admin/support/tickets/:ticketId/close
 */
const closeTicket = async (req, res, next) => {
  try {
    const ticket = await supportService.closeTicket({
      ticketId: req.params.ticketId,
      adminId: req.user.userId
    });
    res.json({ success: true, ticket });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/admin/support/stats
 */
const getSupportStats = async (req, res, next) => {
  try {
    const stats = await supportService.getSupportStats();
    res.json({ success: true, stats });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listTickets,
  getTicket,
  addMessage,
  changeStatus,
  changePriority,
  assignTicket,
  escalateTicket,
  resolveTicket,
  closeTicket,
  getSupportStats
};
