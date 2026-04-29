const mongoose = require('mongoose');

// Group model for standalone group chats (separate from communities)
const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Group name is required'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters'],
    unique: true,
  },
  displayName: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, 'Display name cannot exceed 100 characters'],
  },
  description: {
    type: String,
    trim: true,
    maxlength: [300, 'Description cannot exceed 300 characters'],
    default: '',
  },
  pinnedMessage: {
    type: String,
    trim: true,
    maxlength: [500, 'Pinned message cannot exceed 500 characters'],
    default: '',
  },
  avatarUrl: {
    type: String,
    trim: true,
    default: '',
  },
  creatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // Short join code that users can enter to join the group
  joinCode: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: [4, 'Join code must be at least 4 characters'],
    maxlength: [12, 'Join code cannot exceed 12 characters'],
  },
  // Members of the group (WhatsApp-style membership)
  members: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['owner', 'admin', 'moderator', 'member'],
      default: 'member',
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  hiddenFor: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
  }],
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Group', groupSchema);
