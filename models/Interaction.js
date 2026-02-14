const mongoose = require('mongoose');

// This is the MOST CRITICAL schema for analytics
const interactionSchema = new mongoose.Schema({
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
  mentorshipId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mentorship',
    required: [true, 'Mentorship ID is required'],
    index: true
  },
  topic: {
    type: String,
    required: [true, 'Topic is required'],
    trim: true,
    maxlength: [200, 'Topic cannot exceed 200 characters']
  },
  subjectTag: {
    type: String,
    required: [true, 'Subject tag is required'],
    trim: true,
    enum: {
      values: [
        'Data Structures', 'Algorithms', 'Database Systems', 'Operating Systems',
        'Computer Networks', 'Software Engineering', 'Machine Learning', 'Web Development',
        'Mobile Development', 'Cybersecurity', 'Cloud Computing', 'DevOps',
        'Mathematics', 'Physics', 'Chemistry', 'Other'
      ],
      message: 'Invalid subject tag'
    },
    index: true
  },
  interactionType: {
    type: String,
    required: [true, 'Interaction type is required'],
    enum: {
      values: ['Chat', 'Video Call', 'In-Person', 'Email', 'Forum Discussion', 'Code Review', 'Project Guidance'],
      message: 'Invalid interaction type'
    },
    index: true
  },
  duration: {
    type: Number, // Duration in minutes
    min: [0, 'Duration cannot be negative'],
    default: null
  },
  satisfactionRating: {
    type: Number,
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5'],
    default: null
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters'],
    default: ''
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true,
    index: true
  }
}, {
  timestamps: true
});

// Compound indexes for analytics queries
interactionSchema.index({ mentorId: 1, timestamp: -1 });
interactionSchema.index({ menteeId: 1, timestamp: -1 });
interactionSchema.index({ subjectTag: 1, timestamp: -1 });
interactionSchema.index({ interactionType: 1, timestamp: -1 });
interactionSchema.index({ mentorshipId: 1, timestamp: -1 });

// Index for clustering and trend analysis
interactionSchema.index({ subjectTag: 1, interactionType: 1, timestamp: -1 });

module.exports = mongoose.model('Interaction', interactionSchema);
