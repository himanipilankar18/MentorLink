const express = require('express');
const http = require('http');
const https = require('https');
const User = require('../models/User');
const TechCircleSnapshot = require('../models/TechCircleSnapshot');
const { verifyToken } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/security');

const router = express.Router();

function requestClustering(payload) {
  const serviceUrl = process.env.RECOMMENDATION_SERVICE_URL;
  if (!serviceUrl) return Promise.reject(new Error('Python recommendation service is required for Tech Circles'));
  return new Promise((resolve, reject) => {
    const target = new URL('/tech-circles/cluster', serviceUrl);
    const client = target.protocol === 'https:' ? https : http;
    const request = client.request(target, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      timeout: 30000,
    }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(parsed.detail || 'Tech Circles clustering failed'));
            return;
          }
          resolve(parsed);
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on('timeout', () => request.destroy(new Error('Tech Circles clustering timed out')));
    request.on('error', reject);
    request.write(JSON.stringify(payload));
    request.end();
  });
}

function profileProjection(user) {
  return {
    _id: user._id,
    skills: user.skills,
    interests: user.interests,
    projects: user.projects,
  };
}

function rankedPreview(circle, limit = 5) {
  return (circle.rankedMembers || [])
    .slice()
    .sort((left, right) => (right.score || 0) - (left.score || 0))
    .slice(0, limit);
}

async function hydrateMembers(rankedMembers, currentUserId, filters = {}) {
  const rankingById = new Map(rankedMembers.map((entry) => [String(entry.userId), entry]));
  const users = await User.find({
    _id: { $in: Array.from(rankingById.keys()) },
    isActive: true,
    ...filters,
  }).select('name profilePicture department year role skills interests projects followers following').lean();
  const following = new Set(
    (await User.findById(currentUserId).select('following').lean())?.following?.map(String) || [],
  );
  return users
    .map((user) => {
      const ranking = rankingById.get(String(user._id));
      return {
        ...user,
        relevanceScore: ranking?.score || 0,
        relevanceEvidence: ranking?.evidence || [],
        isFollowing: following.has(String(user._id)),
        followersCount: (user.followers || []).length,
      };
    })
    .sort((left, right) => (right.relevanceScore || 0) - (left.relevanceScore || 0));
}

async function generateSnapshot() {
  const users = await User.find({ isActive: true })
    .select('name profilePicture department year role skills interests projects updatedAt')
    .lean();
  const result = await requestClustering({
    profiles: users.map(profileProjection),
    seed: Number.parseInt(process.env.TECH_CIRCLES_SEED || '41', 10),
  });
  const snapshot = await TechCircleSnapshot.create({
    ...result,
    sourceUpdatedAt: users.reduce((latest, user) => (
      user.updatedAt > latest ? user.updatedAt : latest
    ), new Date(0)),
  });
  return snapshot;
}

router.use(verifyToken, apiLimiter);

router.get('/', async (req, res) => {
  try {
    const snapshot = await TechCircleSnapshot.findOne().sort({ generatedAt: -1 }).lean();
    if (!snapshot) {
      return res.status(404).json({ success: false, message: 'Tech Circles have not been generated yet. An administrator must refresh them.' });
    }
    const clusters = await Promise.all(snapshot.clusters
      .filter((cluster) => cluster.displayable !== false && (cluster.rankedMembers || []).length > 0)
      .map(async (cluster) => ({
      ...cluster,
      members: await hydrateMembers(rankedPreview(cluster, 5), req.user._id),
      })));
    res.json({ success: true, snapshot: { ...snapshot, clusters } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load Tech Circles', error: error.message });
  }
});

router.get('/me', async (req, res) => {
  try {
    const snapshot = await TechCircleSnapshot.findOne().sort({ generatedAt: -1 }).lean();
    if (!snapshot) return res.status(404).json({ success: false, message: 'Tech Circles have not been generated yet' });
    const memberships = snapshot.assignments.filter((entry) => String(entry.userId) === String(req.user._id));
    res.json({ success: true, memberships });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load your Tech Circles', error: error.message });
  }
});

router.get('/search', async (req, res) => {
  try {
    const query = String(req.query.q || '').trim().toLowerCase();
    const snapshot = await TechCircleSnapshot.findOne().sort({ generatedAt: -1 }).lean();
    if (!snapshot) return res.status(404).json({ success: false, message: 'Tech Circles have not been generated yet' });
    const matchingCircles = snapshot.clusters.filter((circle) => circle.displayable !== false && (circle.rankedMembers || []).length > 0).filter((circle) => {
      if (!query) return true;
      return [
        circle.name,
        circle.description,
        ...(circle.representativeTerms || []),
      ].join(' ').toLowerCase().includes(query);
    });
    const filters = {
      ...(req.query.department ? { department: String(req.query.department).toUpperCase() } : {}),
      ...(req.query.year ? { year: Number(req.query.year) } : {}),
    };
    const members = [];
    for (const circle of matchingCircles) {
      members.push(...await hydrateMembers(rankedPreview(circle, 5), req.user._id, filters));
    }
    res.json({
      success: true,
      circles: matchingCircles.map((circle) => ({
        ...circle,
        members: undefined,
      })),
      members,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to search Tech Circles', error: error.message });
  }
});

router.get('/:circleId/members', async (req, res) => {
  try {
    const snapshot = await TechCircleSnapshot.findOne().sort({ generatedAt: -1 }).lean();
    const circle = snapshot?.clusters.find((entry) => entry.displayable !== false && String(entry.id) === String(req.params.circleId));
    if (!circle) return res.status(404).json({ success: false, message: 'Tech Circle not found' });
    const requestedLimit = Number(req.query.limit || 10);
    if (![5, 10].includes(requestedLimit)) {
      return res.status(400).json({ success: false, message: 'limit must be 5 or 10' });
    }
    const members = await hydrateMembers(rankedPreview(circle, requestedLimit), req.user._id);
    res.json({
      success: true,
      circle: {
        ...circle,
        members,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load Tech Circle members', error: error.message });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    if (String(req.user.role || '').toLowerCase() !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only administrators can refresh Tech Circles' });
    }
    const snapshot = await generateSnapshot();
    res.status(201).json({ success: true, snapshot });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to refresh Tech Circles', error: error.message });
  }
});

module.exports = router;
