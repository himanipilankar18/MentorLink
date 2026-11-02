const mongoose = require('mongoose');

const techCircleSnapshotSchema = new mongoose.Schema({
  algorithm: { type: String, required: true },
  seed: { type: Number, required: true },
  profileCount: { type: Number, required: true, min: 0 },
  sourceUpdatedAt: { type: Date, default: Date.now },
  generatedAt: { type: Date, default: Date.now },
  metrics: {
    silhouette: { type: Number, default: null },
    daviesBouldin: { type: Number, default: null },
    calinskiHarabasz: { type: Number, default: null },
    stabilityARI: { type: Number, default: null },
  },
  clusters: { type: [mongoose.Schema.Types.Mixed], default: [] },
  assignments: { type: [mongoose.Schema.Types.Mixed], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('TechCircleSnapshot', techCircleSnapshotSchema);
