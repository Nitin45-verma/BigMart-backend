const express = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

const router = express.Router();

/**
 * @route GET /api/v1/test/customer
 * @desc  Customer-accessible test route
 * @access Customer, Seller, Admin
 */
router.get(
  '/customer',
  authenticate,
  authorizeRoles('customer', 'seller', 'admin'),
  (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Customer access granted',
      data: {
        user: {
          id: req.user.userId,
          role: req.user.role
        }
      }
    });
  }
);

/**
 * @route GET /api/v1/test/seller
 * @desc  Seller-accessible test route
 * @access Seller, Admin
 */
router.get(
  '/seller',
  authenticate,
  authorizeRoles('seller', 'admin'),
  (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Seller access granted',
      data: {
        user: {
          id: req.user.userId,
          role: req.user.role
        }
      }
    });
  }
);

/**
 * @route GET /api/v1/test/admin
 * @desc  Admin-only test route
 * @access Admin only
 */
router.get(
  '/admin',
  authenticate,
  authorizeRoles('admin'),
  (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Admin access granted',
      data: {
        user: {
          id: req.user.userId,
          role: req.user.role
        }
      }
    });
  }
);

module.exports = router;
