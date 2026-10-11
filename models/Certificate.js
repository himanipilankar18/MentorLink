const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
  certificateId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  mentorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  achievementId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Achievement',
    required: true,
    unique: true,
  },
  title: {
    type: String,
    required: true,
  },
  pointsAtIssuance: {
    type: Number,
    required: true,
  },
  confirmedInteractions: {
    type: Number,
    required: true,
  },
  uniqueMentees: {
    type: Number,
    required: true,
  },
  averageRating: {
    type: Number,
    default: null,
  },
  issuedAt: {
    type: Date,
    default: Date.now,
  },
  revokedAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

module.exports = mongoose.model('Certificate', certificateSchema);
