const express = require('express');
const adminUserController = require('../controllers/adminUserController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { validateUserIdParam, validateUserRoleInput } = require('../validators/adminValidator');

const router = express.Router();

router.use(authenticate, authorizeRoles('admin'));

router.get('/', adminUserController.getUsers);
router.get('/:userId', validateUserIdParam, adminUserController.getUserById);
router.patch('/:userId/block', validateUserIdParam, adminUserController.blockUser);
router.patch('/:userId/unblock', validateUserIdParam, adminUserController.unblockUser);
router.patch('/:userId/role', validateUserIdParam, validateUserRoleInput, adminUserController.updateUserRole);

module.exports = router;
