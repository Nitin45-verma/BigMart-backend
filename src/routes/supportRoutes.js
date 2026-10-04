const express = require('express');
const router = express.Router();

const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const supportController = require('../controllers/supportController');
const {
  validateCreateTicket,
  validateTicketId,
  validateAddMessage,
  validateStatusChange
} = require('../validators/supportValidator');

/**
 * Customer & Seller Support Routes
 * Authentication required for all routes.
 * Non-admins can only see/manage their own tickets.
 */

// POST /api/v1/support/tickets — create ticket
router.post(
  '/tickets',
  authenticate,
  authorizeRoles('customer', 'seller'),
  ...validateCreateTicket,
  supportController.createTicket
);

// GET /api/v1/support/tickets — list own tickets
router.get(
  '/tickets',
  authenticate,
  authorizeRoles('customer', 'seller'),
  supportController.listTickets
);

// GET /api/v1/support/tickets/:ticketId — view own ticket + messages
router.get(
  '/tickets/:ticketId',
  authenticate,
  authorizeRoles('customer', 'seller'),
  validateTicketId,
  supportController.getTicket
);

// POST /api/v1/support/tickets/:ticketId/messages — add message
router.post(
  '/tickets/:ticketId/messages',
  authenticate,
  authorizeRoles('customer', 'seller'),
  validateTicketId,
  ...validateAddMessage,
  supportController.addMessage
);

// PATCH /api/v1/support/tickets/:ticketId/status — change status (limited)
router.patch(
  '/tickets/:ticketId/status',
  authenticate,
  authorizeRoles('customer', 'seller'),
  validateTicketId,
  validateStatusChange,
  supportController.changeStatus
);

module.exports = router;
