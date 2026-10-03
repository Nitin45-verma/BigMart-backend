const mongoose = require('mongoose');

const adminAuditLogSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Admin reference is required'],
      index: true
    },
    action: {
      type: String,
      required: [true, 'Action name is required'],
      trim: true,
      index: true
    },
    targetType: {
      type: String,
      required: [true, 'Target type is required'],
      enum: ['User', 'Seller', 'Product', 'Order', 'ReturnRequest', 'Category', 'PlatformFeeConfig', 'ProductReview', 'System'],
      index: true
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    ipAddress: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for administrative audit queries
adminAuditLogSchema.index({ admin: 1, action: 1, createdAt: -1 });
adminAuditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
adminAuditLogSchema.index({ createdAt: -1 });

const AdminAuditLog = mongoose.model('AdminAuditLog', adminAuditLogSchema);

module.exports = AdminAuditLog;
