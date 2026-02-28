const mongoose = require('mongoose');

const communitySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Community name is required'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  displayName: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, 'Display name cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  type: {
    type: String,
    enum: ['public', 'private', 'restricted'],
    default: 'public'
  },
  category: {
    type: String,
    enum: [
      'Technology', 'Science', 'Mathematics', 'Engineering', 
      'Arts', 'Business', 'Social', 'Gaming', 'Sports', 
      'Music', 'Education', 'Career', 'Projects', 'Study Groups',
      'General', 'Other'
    ],
    default: 'General'
  },
  creatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  moderators: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  members: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    role: {
      type: String,
      enum: ['member', 'moderator', 'admin'],
      default: 'member'
    }
  }],
  icon: {
    type: String,
    default: ''
  },
  banner: {
    type: String,
    default: ''
  },
  rules: [{
    title: String,
    description: String
  }],
  tags: [{
    type: String,
    trim: true
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  postCount: {
    type: Number,
    default: 0
  },
  settings: {
    allowPosts: {
      type: Boolean,
      default: true
    },
    requireApproval: {
      type: Boolean,
      default: false
    },
    allowImages: {
      type: Boolean,
      default: true
    },
    allowPolls: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true
});

// Indexes
communitySchema.index({ name: 1 });
communitySchema.index({ category: 1 });
communitySchema.index({ type: 1 });
communitySchema.index({ 'members.userId': 1 });

// Virtual for member count
communitySchema.virtual('memberCount').get(function() {
  return this.members.length;
});

// Method to add member
communitySchema.methods.addMember = function(userId) {
  const existing = this.members.find(m => m.userId.toString() === userId.toString());
  if (!existing) {
    this.members.push({ userId, role: 'member' });
  }
  return this.save();
};

// Method to remove member
communitySchema.methods.removeMember = function(userId) {
  this.members = this.members.filter(m => m.userId.toString() !== userId.toString());
  return this.save();
};

// Method to check if user is member
communitySchema.methods.isMember = function(userId) {
  return this.members.some(m => m.userId.toString() === userId.toString());
};

// Method to check if user is moderator
communitySchema.methods.isModerator = function(userId) {
  return this.moderators.some(m => m.toString() === userId.toString()) ||
         this.members.some(m => m.userId.toString() === userId.toString() && 
                           (m.role === 'moderator' || m.role === 'admin'));
};

// Ensure virtuals are included
communitySchema.set('toJSON', { virtuals: true });
communitySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Community', communitySchema);
