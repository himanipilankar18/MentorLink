const mongoose = require('mongoose');

const mentorshipSchema = new mongoose.Schema({
  requester: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
    default: null
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
    default: null
  },
  mentorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Mentor ID is required'],
    index: true
  },
  menteeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Mentee ID is required'],
    index: true
  },
  reason: {
    type: String,
    trim: true,
    maxlength: [2000, 'Reason cannot exceed 2000 characters'],
    default: ''
  },
  rejectionReason: {
    type: String,
    trim: true,
    maxlength: [2000, 'Rejection reason cannot exceed 2000 characters'],
    default: ''
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'accepted', 'rejected', 'terminated'],
      message: 'Status must be pending, accepted, rejected, or terminated'
    },
    default: 'pending',
    required: true
  },
  chatGroupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    default: null
  },
  requestedAt: {
    type: Date,
    default: Date.now
  },
  acceptedAt: {
    type: Date,
    default: null
  },
  terminatedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Keep new/old participant fields synchronized for backward compatibility.
mentorshipSchema.pre('validate', function(next) {
  if (!this.requester && this.menteeId) {
    this.requester = this.menteeId;
  }

  if (!this.menteeId && this.requester) {
    this.menteeId = this.requester;
  }

  if (!this.recipient && this.mentorId) {
    this.recipient = this.mentorId;
  }

  if (!this.mentorId && this.recipient) {
    this.mentorId = this.recipient;
  }

  if (typeof this.status === 'string') {
    this.status = this.status.toLowerCase();
  }

  if (typeof this.reason === 'string') {
    this.reason = this.reason.trim();
  }

  if (typeof this.rejectionReason === 'string') {
    this.rejectionReason = this.rejectionReason.trim();
  }

  next();
});

// Compound indexes to prevent duplicate requests
mentorshipSchema.index({ requester: 1, recipient: 1 }, { unique: true, sparse: true });
mentorshipSchema.index({ mentorId: 1, menteeId: 1 }, { unique: true });

// Index for efficient queries
mentorshipSchema.index({ status: 1 });
mentorshipSchema.index({ requester: 1, status: 1 });
mentorshipSchema.index({ recipient: 1, status: 1 });
mentorshipSchema.index({ mentorId: 1, status: 1 });
mentorshipSchema.index({ menteeId: 1, status: 1 });

// Method to accept mentorship
mentorshipSchema.methods.accept = function(chatGroupId = null) {
  this.status = 'accepted';
  this.acceptedAt = new Date();
  this.rejectionReason = '';
  if (chatGroupId) {
    this.chatGroupId = chatGroupId;
  }
  return this.save();
};

// Method to reject mentorship
mentorshipSchema.methods.reject = function(reason = '') {
  this.status = 'rejected';
  if (typeof reason === 'string') {
    this.rejectionReason = reason.trim();
  }
  return this.save();
};

// Method to terminate mentorship
mentorshipSchema.methods.terminate = function() {
  this.status = 'terminated';
  this.terminatedAt = new Date();
  return this.save();
};

module.exports = mongoose.model('Mentorship', mentorshipSchema);
