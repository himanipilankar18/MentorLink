require('dotenv').config();

const mongoose = require('mongoose');
const User = require('../models/User');
const TechCircleSnapshot = require('../models/TechCircleSnapshot');
const connectDB = require('../config/database');

async function requestClustering(payload) {
  const serviceUrl = process.env.RECOMMENDATION_SERVICE_URL || 'http://127.0.0.1:8000';
  const response = await fetch(new URL('/tech-circles/cluster', serviceUrl), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(120000),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.detail || 'Tech Circles clustering failed');
  }
  return body;
}

async function refreshTechCircles() {
  await connectDB();
  const users = await User.find({ isActive: true })
    .select('_id skills interests projects updatedAt')
    .lean();
  if (!users.length) {
    throw new Error('No active user profiles were found');
  }

  const result = await requestClustering({
    profiles: users.map((user) => ({
      _id: user._id,
      skills: user.skills,
      interests: user.interests,
      projects: user.projects,
    })),
    seed: Number.parseInt(process.env.TECH_CIRCLES_SEED || '41', 10),
  });
  if (!Array.isArray(result.clusters)) {
    throw new Error('Clustering returned no valid cluster list');
  }

  const snapshot = await TechCircleSnapshot.create({
    ...result,
    sourceUpdatedAt: users.reduce((latest, user) => (
      user.updatedAt > latest ? user.updatedAt : latest
    ), new Date(0)),
  });
  const audit = result.metrics?.featureAudit || {};
  const domains = result.clusters.filter((cluster) => (
    cluster.displayable !== false && (cluster.rankedMembers || []).length > 0
  ));

  console.log(JSON.stringify({
    profilesFetched: users.length,
    profilesWithValidSkills: audit.usersWithUsableSkills ?? null,
    uniqueNormalizedSkills: audit.uniqueNormalizedSkills ?? null,
    featureMatrixDimensions: audit.finalFeatureDimensions ?? null,
    testedK: (result.metrics?.testedK || []).map((entry) => entry.k),
    selectedK: result.metrics?.selectedK ?? null,
    selectedMetrics: {
      silhouette: result.metrics?.silhouette ?? null,
      daviesBouldin: result.metrics?.daviesBouldin ?? null,
      calinskiHarabasz: result.metrics?.calinskiHarabasz ?? null,
      inertia: result.metrics?.inertia ?? null,
      stabilityARI: result.metrics?.stabilityARI ?? null,
    },
    domains: domains.map((domain) => ({
      name: domain.name,
      memberCount: domain.size,
      representativeSkills: domain.representativeTerms,
      topFive: (domain.rankedMembers || []).slice(0, 5).map((member) => ({
        userId: member.userId,
        score: member.score,
        evidence: member.evidence,
      })),
    })),
    snapshotId: String(snapshot._id),
  }, null, 2));
  if (!domains.length) {
    throw new Error('Clustering completed but produced no publishable technical domains');
  }
}

refreshTechCircles()
  .catch((error) => {
    console.error(`Tech Circles refresh failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
