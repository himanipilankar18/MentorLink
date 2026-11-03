const mongoose = require('mongoose');

const demoMentoringEvidenceSchema = new mongoose.Schema({
  mentorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  },
  totalInteractions: { type: Number, min: 0, default: 0 },
  avgSatisfaction: { type: Number, min: 0, max: 5, default: 0 },
  subjectBreadth: { type: Number, min: 0, default: 0 },
  acceptedMentorships: { type: Number, min: 0, default: 0 },
  completionRate: { type: Number, min: 0, max: 1, default: 0 },
  recencyScore: { type: Number, min: 0, max: 1, default: 0 },
  achievementLevel: { type: Number, min: 0, default: 0 },
  achievementInteractions: { type: Number, min: 0, default: 0 },
  achievementMentees: { type: Number, min: 0, default: 0 },
  achievementRating: { type: Number, min: 0, max: 5, default: 0 },
  // Session-level summary fields, matching what real confirmed interactions provide.
  ratingCount: { type: Number, min: 0, default: 0 },
  uniqueMentees: { type: Number, min: 0, default: 0 },
  resolvedInteractions: { type: Number, min: 0, default: 0 },
  verifiedCompletedSessions: { type: Number, min: 0, default: 0 },
  lastInteractionAt: { type: Date, default: null },
  generator: { type: String, default: null },
  demoOnly: { type: Boolean, required: true, default: true },
}, { timestamps: true });

module.exports = mongoose.model('DemoMentoringEvidence', demoMentoringEvidenceSchema);
