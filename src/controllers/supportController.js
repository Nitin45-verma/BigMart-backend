const supportService = require('../services/supportService');
const ApiError = require('../utils/ApiError');

/**
 * POST /api/v1/support/tickets
 * Customer creates a support ticket.
 */
const createTicket = async (req, res, next) => {
  try {
    const {
      subject, description, category, priority,
      order, product, returnRequest, payout, paymentReference
    } = req.body;

    const ticket = await supportService.createTicket({
      userId: req.user.userId,
      role: req.user.role,
      subject,
      description,
      category,
      priority,
      orderId: order || null,
      productId: product || null,
      returnRequestId: returnRequest || null,
      payoutId: payout || null,
      paymentReference: paymentReference || null
    });

    res.status(201).json({ success: true, ticket });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/support/tickets
 * Customer lists their own tickets.
 */
const listTickets = async (req, res, next) => {
  try {
    const result = await supportService.listTickets({
      userId: req.user.userId,
      role: req.user.role,
      query: req.query
    });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/support/tickets/:ticketId
 * Customer views their own ticket.
 */
const getTicket = async (req, res, next) => {
  try {
    const ticket = await supportService.getTicket({
      ticketId: req.params.ticketId,
      userId: req.user.userId,
      role: req.user.role
    });
    // Get public messages
    const messages = await supportService.getTicketMessages({
      ticketId: req.params.ticketId,
      userId: req.user.userId,
      role: req.user.role
    });
    res.json({ success: true, ticket, messages });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/support/tickets/:ticketId/messages
 * Customer adds a message to their ticket.
 */
const addMessage = async (req, res, next) => {
  try {
    const { message, attachments } = req.body;
    const msg = await supportService.addMessage({
      ticketId: req.params.ticketId,
      senderId: req.user.userId,
      senderRole: req.user.role,
      message,
      attachments: Array.isArray(attachments) ? attachments : [],
      isInternal: false // Customers/sellers can never create internal notes
    });
    res.status(201).json({ success: true, message: msg });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v1/support/tickets/:ticketId/status
 * Customer can close a RESOLVED ticket.
 */
const changeStatus = async (req, res, next) => {
  try {
    const ticket = await supportService.changeStatus({
      ticketId: req.params.ticketId,
      userId: req.user.userId,
      role: req.user.role,
      newStatus: req.body.status
    });
    res.json({ success: true, ticket });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createTicket,
  listTickets,
  getTicket,
  addMessage,
  changeStatus
};
