const express = require('express');
const router = express.Router();

const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const adminSupportController = require('../controllers/adminSupportController');
const {
  validateTicketId,
  validateAddMessage,
  validateStatusChange,
  validatePriorityChange,
  validateAssignTicket,
  validateEscalation,
  validateAdminListQuery
} = require('../validators/supportValidator');

/**
 * Admin Support/Helpdesk Routes
 * All routes require: authenticate + restrictTo('admin')
 */

// GET /api/v1/admin/support/stats
router.get(
  '/stats',
  authenticate,
  authorizeRoles('admin'),
  adminSupportController.getSupportStats
);

// GET /api/v1/admin/support/tickets
router.get(
  '/tickets',
  authenticate,
  authorizeRoles('admin'),
  validateAdminListQuery,
  adminSupportController.listTickets
);

// GET /api/v1/admin/support/tickets/:ticketId
router.get(
  '/tickets/:ticketId',
  authenticate,
  authorizeRoles('admin'),
  validateTicketId,
  adminSupportController.getTicket
);

// POST /api/v1/admin/support/tickets/:ticketId/messages
router.post(
  '/tickets/:ticketId/messages',
  authenticate,
  authorizeRoles('admin'),
  validateTicketId,
  ...validateAddMessage,
  adminSupportController.addMessage
);

// PATCH /api/v1/admin/support/tickets/:ticketId/status
router.patch(
  '/tickets/:ticketId/status',
  authenticate,
  authorizeRoles('admin'),
  validateTicketId,
  validateStatusChange,
  adminSupportController.changeStatus
);

// PATCH /api/v1/admin/support/tickets/:ticketId/priority
router.patch(
  '/tickets/:ticketId/priority',
  authenticate,
  authorizeRoles('admin'),
  validateTicketId,
  validatePriorityChange,
  adminSupportController.changePriority
);

// PATCH /api/v1/admin/support/tickets/:ticketId/assign
router.patch(
  '/tickets/:ticketId/assign',
  authenticate,
  authorizeRoles('admin'),
  validateTicketId,
  validateAssignTicket,
  adminSupportController.assignTicket
);

// PATCH /api/v1/admin/support/tickets/:ticketId/escalate
router.patch(
  '/tickets/:ticketId/escalate',
  authenticate,
  authorizeRoles('admin'),
  validateTicketId,
  validateEscalation,
  adminSupportController.escalateTicket
);

// PATCH /api/v1/admin/support/tickets/:ticketId/resolve
router.patch(
  '/tickets/:ticketId/resolve',
  authenticate,
  authorizeRoles('admin'),
  validateTicketId,
  adminSupportController.resolveTicket
);

// PATCH /api/v1/admin/support/tickets/:ticketId/close
router.patch(
  '/tickets/:ticketId/close',
  authenticate,
  authorizeRoles('admin'),
  validateTicketId,
  adminSupportController.closeTicket
);

module.exports = router;
