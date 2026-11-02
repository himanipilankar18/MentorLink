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
    bio: user.bio,
    careerInterests: user.careerInterests,
    careerGoals: user.careerGoals,
    expertise: user.expertise,
    courses: user.courses,
    certifications: user.certifications,
  };
}

async function generateSnapshot() {
  const users = await User.find({ isActive: true })
    .select('name profilePicture department year role skills interests projects bio careerInterests careerGoals expertise courses certifications updatedAt')
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
    const users = await User.find({
      _id: { $in: snapshot.clusters.flatMap((cluster) => cluster.memberIds || []) },
      isActive: true,
    }).select('name profilePicture department year role skills interests projects').lean();
    const byId = new Map(users.map((user) => [String(user._id), user]));
    const clusters = snapshot.clusters.map((cluster) => ({
      ...cluster,
      members: (cluster.memberIds || []).map((id) => byId.get(String(id))).filter(Boolean),
    }));
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

router.get('/:circleId/members', async (req, res) => {
  try {
    const snapshot = await TechCircleSnapshot.findOne().sort({ generatedAt: -1 }).lean();
    const circle = snapshot?.clusters.find((entry) => String(entry.id) === String(req.params.circleId));
    if (!circle) return res.status(404).json({ success: false, message: 'Tech Circle not found' });
    const members = await User.find({ _id: { $in: circle.memberIds }, isActive: true })
      .select('name profilePicture department year role skills interests projects')
      .lean();
    res.json({ success: true, circle: { ...circle, members } });
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
