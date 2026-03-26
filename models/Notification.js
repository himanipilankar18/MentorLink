const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  type: {
    type: String,
    required: true,
    enum: ['MENTORSHIP_REQUEST', 'REQUEST_ACCEPTED', 'REQUEST_REJECTED', 'NEW_MESSAGE'],
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: [500, 'Notification message cannot exceed 500 characters'],
  },
  relatedId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true,
  },
}, {
  timestamps: true,
});

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
