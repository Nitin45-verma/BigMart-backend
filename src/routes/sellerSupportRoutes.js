const express = require('express');
const router = express.Router();

const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { authorizeSeller } = require('../middleware/sellerMiddleware');
const supportController = require('../controllers/supportController');
const {
  validateCreateTicket,
  validateTicketId,
  validateAddMessage,
  validateStatusChange
} = require('../validators/supportValidator');

/**
 * Seller Support Routes — uses authorizeSeller middleware.
 * All routes require full seller authorization (approved seller).
 */
router.use(authenticate, authorizeRoles('seller'), authorizeSeller);

// POST /api/v1/seller/support/tickets
router.post(
  '/tickets',
  ...validateCreateTicket,
  supportController.createTicket
);

// GET /api/v1/seller/support/tickets
router.get('/tickets', supportController.listTickets);

// GET /api/v1/seller/support/tickets/:ticketId
router.get('/tickets/:ticketId', validateTicketId, supportController.getTicket);

// POST /api/v1/seller/support/tickets/:ticketId/messages
router.post(
  '/tickets/:ticketId/messages',
  validateTicketId,
  ...validateAddMessage,
  supportController.addMessage
);

// PATCH /api/v1/seller/support/tickets/:ticketId/status
router.patch(
  '/tickets/:ticketId/status',
  validateTicketId,
  validateStatusChange,
  supportController.changeStatus
);

module.exports = router;
