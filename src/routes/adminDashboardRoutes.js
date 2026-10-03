const express = require('express');
const adminDashboardController = require('../controllers/adminDashboardController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(authenticate, authorizeRoles('admin'));

router.get('/summary', adminDashboardController.getSummary);

module.exports = router;
