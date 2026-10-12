const mongoose = require('mongoose');

const contributionEventSchema = new mongoose.Schema({
  mentorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  menteeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  mentorshipId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mentorship',
    required: true,
  },
  interactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Interaction',
    required: true,
  },
  eventType: {
    type: String,
    enum: ['SESSION_CONFIRMED', 'HIGH_SATISFACTION', 'LONG_SESSION'],
    required: true,
  },
  points: {
    type: Number,
    required: true,
    min: 0,
  },
  evidence: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, { timestamps: true });

contributionEventSchema.index({ interactionId: 1, eventType: 1 }, { unique: true });
contributionEventSchema.index({ mentorId: 1, createdAt: -1 });

module.exports = mongoose.model('ContributionEvent', contributionEventSchema);
