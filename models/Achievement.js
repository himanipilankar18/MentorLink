const mongoose = require('mongoose');

const achievementSchema = new mongoose.Schema({
  mentorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  level: {
    type: Number,
    required: true,
    min: 1,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  pointsAtAward: {
    type: Number,
    required: true,
    min: 0,
  },
  confirmedInteractions: {
    type: Number,
    required: true,
    min: 0,
  },
  uniqueMentees: {
    type: Number,
    required: true,
    min: 0,
  },
  averageRating: {
    type: Number,
    default: null,
    min: 1,
    max: 5,
  },
  awardedAt: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

achievementSchema.index({ mentorId: 1, level: 1 }, { unique: true });

module.exports = mongoose.model('Achievement', achievementSchema);
