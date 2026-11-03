const mongoose = require('mongoose');

// One document per mentor list shown to a user on Find Mentor.
// Later actions on that list (views, requests, accepts, feedback) are appended as events,
// so ranking quality can be measured from real use.
const EVENT_TYPES = [
  'viewed_details', // opened the card details
  'opened_profile', // opened the mentor's profile
  'helpful', // "Helpful match" button
  'not_helpful', // "Not a good match" button
  'requested', // sent a mentorship request to this mentor
  'accepted', // the mentor accepted that request
  'rejected', // the mentor rejected that request
];

const recommendationLogSchema = new mongoose.Schema({
  seekerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  engine: { type: String, default: 'js' }, // 'python' or 'js' (fallback)
  engineVersion: { type: String, default: null },
  demoEvidence: { type: Boolean, default: false },
  candidateCount: { type: Number, default: 0 },
  items: [{
    _id: false,
    mentorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rank: { type: Number, required: true },
    score: { type: Number, default: null },
  }],
  events: [{
    _id: false,
    mentorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: EVENT_TYPES, required: true },
    rank: { type: Number, default: null },
    at: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

recommendationLogSchema.index({ seekerId: 1, createdAt: -1 });
recommendationLogSchema.index({ 'items.mentorId': 1 });

const RecommendationLog = mongoose.model('RecommendationLog', recommendationLogSchema);
RecommendationLog.EVENT_TYPES = EVENT_TYPES;

module.exports = RecommendationLog;
