const mongoose = require('mongoose');

// Simple group-based chat message (separate from communities)
const chatMessageSchema = new mongoose.Schema({
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true,
    index: true,
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  content: {
    type: String,
    required: [true, 'Message content is required'],
    trim: true,
    maxlength: [2000, 'Message cannot exceed 2000 characters'],
  },
}, {
  timestamps: true,
});

chatMessageSchema.index({ groupId: 1, createdAt: -1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
