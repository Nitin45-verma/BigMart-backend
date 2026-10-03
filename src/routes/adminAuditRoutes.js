const express = require('express');
const adminAuditController = require('../controllers/adminAuditController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(authenticate, authorizeRoles('admin'));

router.get('/', adminAuditController.getAuditLogs);

module.exports = router;
