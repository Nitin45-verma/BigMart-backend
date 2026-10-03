const mongoose = require('mongoose');

const reviewReportSchema = new mongoose.Schema(
  {
    review: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProductReview',
      required: [true, 'Review reference is required'],
      index: true
    },
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reporter reference is required'],
      index: true
    },
    reason: {
      type: String,
      enum: {
        values: ['spam', 'abusive', 'offensive', 'fake', 'irrelevant', 'other'],
        message: '{VALUE} is not a valid report reason'
      },
      required: [true, 'Report reason is required']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'reviewed', 'dismissed', 'actioned'],
        message: '{VALUE} is not a valid report status'
      },
      default: 'pending',
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Prevent duplicate reports from the same customer for the same review
reviewReportSchema.index({ review: 1, reporter: 1 }, { unique: true });

// Compound index for admin review of reports
reviewReportSchema.index({ status: 1, createdAt: -1 });

const ReviewReport = mongoose.model('ReviewReport', reviewReportSchema);

module.exports = ReviewReport;
