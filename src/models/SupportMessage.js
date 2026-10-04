const mongoose = require('mongoose');

const VALID_ATTACHMENT_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_ATTACHMENTS_PER_MESSAGE = 5;

const attachmentSchema = new mongoose.Schema(
  {
    fileId: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    fileName: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true, trim: true },
    size: { type: Number, required: true, min: 0 }
  },
  { _id: false, timestamps: { createdAt: true, updatedAt: false } }
);

const supportMessageSchema = new mongoose.Schema(
  {
    ticket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SupportTicket',
      required: [true, 'Ticket reference is required'],
      index: true
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender is required'],
      index: true
    },
    senderRole: {
      type: String,
      enum: { values: ['customer', 'seller', 'admin'], message: '{VALUE} is not a valid sender role' },
      required: [true, 'Sender role is required']
    },
    message: {
      type: String,
      required: [true, 'Message text is required'],
      trim: true,
      minlength: [1, 'Message cannot be empty'],
      maxlength: [5000, 'Message cannot exceed 5000 characters']
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
      validate: {
        validator: (arr) => arr.length <= MAX_ATTACHMENTS_PER_MESSAGE,
        message: `Maximum ${MAX_ATTACHMENTS_PER_MESSAGE} attachments allowed per message`
      }
    },
    /**
     * Internal notes are only visible to admins.
     * Customer/seller messages always have isInternal=false.
     * Only admins can set isInternal=true.
     */
    isInternal: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  {
    timestamps: true
  }
);

supportMessageSchema.index({ ticket: 1, createdAt: 1 });
supportMessageSchema.index({ ticket: 1, isInternal: 1, createdAt: 1 });

const SupportMessage = mongoose.model('SupportMessage', supportMessageSchema);

SupportMessage.VALID_ATTACHMENT_TYPES = VALID_ATTACHMENT_TYPES;
SupportMessage.MAX_ATTACHMENT_SIZE = MAX_ATTACHMENT_SIZE;
SupportMessage.MAX_ATTACHMENTS_PER_MESSAGE = MAX_ATTACHMENTS_PER_MESSAGE;

module.exports = SupportMessage;
