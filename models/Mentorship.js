const mongoose = require('mongoose');

const mentorshipSchema = new mongoose.Schema({
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
  status: {
    type: String,
    enum: {
      values: ['Pending', 'Accepted', 'Rejected', 'Terminated'],
      message: 'Status must be Pending, Accepted, Rejected, or Terminated'
    },
    default: 'Pending',
    required: true
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

// Compound index to prevent duplicate requests
mentorshipSchema.index({ mentorId: 1, menteeId: 1 }, { unique: true });

// Index for efficient queries
mentorshipSchema.index({ status: 1 });
mentorshipSchema.index({ mentorId: 1, status: 1 });
mentorshipSchema.index({ menteeId: 1, status: 1 });

// Method to accept mentorship
mentorshipSchema.methods.accept = function() {
  this.status = 'Accepted';
  this.acceptedAt = new Date();
  return this.save();
};

// Method to reject mentorship
mentorshipSchema.methods.reject = function() {
  this.status = 'Rejected';
  return this.save();
};

// Method to terminate mentorship
mentorshipSchema.methods.terminate = function() {
  this.status = 'Terminated';
  this.terminatedAt = new Date();
  return this.save();
};

module.exports = mongoose.model('Mentorship', mentorshipSchema);
