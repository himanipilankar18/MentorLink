const express = require('express');
const path = require('path');
const { spawnSync } = require('child_process');
const User = require('../models/User');
const Interaction = require('../models/Interaction');
const Mentorship = require('../models/Mentorship');
const { verifyToken, checkRole } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/security');
const sendEmail = require('../utils/sendEmail');
const { createAndEmitNotification } = require('../utils/notifications');
const { buildPeerRecommendations } = require('../recommender_model/src/peerMatcher');

const router = express.Router();

const MAX_SKILLS = 10;

function normalizeSkills(input) {
  if (!Array.isArray(input)) return [];

  const normalized = input
    .map((skill) => String(skill || '').trim().toLowerCase())
    .filter(Boolean);

  return Array.from(new Set(normalized));
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function computeUserSearchScore(user, queryLower, isFollowing) {
  const name = String(user.name || '').toLowerCase();
  const email = String(user.email || '').toLowerCase();
  const emailLocal = email.split('@')[0] || '';
  const queryToken = queryLower.replace(/\s+/g, '');

  let score = 0;
  let hasTextMatch = false;

  if (name === queryLower) {
    score += 120;
    hasTextMatch = true;
  } else if (name.startsWith(queryLower)) {
    score += 80;
    hasTextMatch = true;
  } else if (name.split(/\s+/).some((part) => part.startsWith(queryLower))) {
    score += 55;
    hasTextMatch = true;
  } else if (name.includes(queryLower)) {
    score += 30;
    hasTextMatch = true;
  }

  if (email.startsWith(queryLower)) {
    score += 20;
    hasTextMatch = true;
  } else if (email.includes(queryLower)) {
    score += 10;
    hasTextMatch = true;
  }

  const fuzzyName = bestFuzzySimilarity(name, queryLower);
  const fuzzyEmail = bestFuzzySimilarity(emailLocal, queryLower);
  const bestFuzzy = Math.max(fuzzyName, fuzzyEmail);

  if (bestFuzzy >= 0.82) {
    score += 40;
    hasTextMatch = true;
  } else if (bestFuzzy >= 0.72) {
    score += 28;
    hasTextMatch = true;
  } else if (bestFuzzy >= 0.62) {
    score += 16;
    hasTextMatch = true;
  }

  const compactName = name.replace(/\s+/g, '');
  if (queryToken && isSubsequence(compactName, queryToken)) {
    score += 8;
    hasTextMatch = true;
  }

  // Keep social/activity boosts only when there is an actual text match.
  if (hasTextMatch) {
    if (isFollowing) score += 12;
    if (user.isOnline) score += 8;
  }

  return hasTextMatch ? score : 0;
}

function levenshteinDistance(a, b) {
  const s1 = String(a || '');
  const s2 = String(b || '');
  const rows = s1.length + 1;
  const cols = s2.length + 1;

  const matrix = Array.from({ length: rows }, () => new Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[rows - 1][cols - 1];
}

function normalizedSimilarity(a, b) {
  const left = String(a || '').trim();
  const right = String(b || '').trim();
  if (!left || !right) return 0;

  const maxLen = Math.max(left.length, right.length);
  if (!maxLen) return 0;

  const distance = levenshteinDistance(left, right);
  return Math.max(0, 1 - (distance / maxLen));
}

function bestFuzzySimilarity(text, query) {
  const source = String(text || '').toLowerCase();
  const q = String(query || '').toLowerCase();
  if (!source || !q) return 0;

  const tokens = source.split(/[^a-z0-9]+/).filter(Boolean);
  let best = normalizedSimilarity(source, q);

  for (const token of tokens) {
    best = Math.max(best, normalizedSimilarity(token, q));
  }

  return best;
}

function isSubsequence(text, query) {
  const t = String(text || '');
  const q = String(query || '');
  if (!t || !q) return false;

  let i = 0;
  let j = 0;
  while (i < t.length && j < q.length) {
    if (t[i] === q[j]) j += 1;
    i += 1;
  }

  return j === q.length;
}

function isPlaceholderProfile(user) {
  const name = String(user?.name || '').trim().toLowerCase();
  const email = String(user?.email || '').trim().toLowerCase();

  if (!name) return true;

  if (email.endsWith('@peer.synthetic.spit.ac.in')) return true;
  if (email.endsWith('@test.spit.ac.in')) return true;

  const placeholderPatterns = [
    /^recommendation\b/i,
    /^mentor\b/i,
    /^mentee\b/i,
    /\bfaculty\b/i,
    /\bjunior\b/i,
    /\btest\b/i,
    /\bdummy\b/i,
    /^peer user\b/i,
    /\bsynthetic\b/i,
  ];

  return placeholderPatterns.some((pattern) => pattern.test(name));
}

const PROJECT_SYNONYM_GROUPS = [
  ['donation', 'charity', 'fundraiser', 'fundraising', 'ngo', 'nonprofit', 'non-profit', 'crowdfunding', 'philanthropy', 'relief'],
  ['health', 'medical', 'clinic', 'hospital', 'wellness', 'healthcare'],
  ['education', 'learning', 'edtech', 'teaching', 'classroom', 'school'],
  ['environment', 'climate', 'sustainability', 'green', 'recycle', 'recycling'],
  ['jobs', 'career', 'employment', 'hiring', 'recruitment', 'internship'],
];

function tokenizeText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function expandSemanticTerms(queryText) {
  const queryTokens = tokenizeText(queryText);
  const terms = new Set(queryTokens);

  for (const token of queryTokens) {
    for (const group of PROJECT_SYNONYM_GROUPS) {
      if (group.includes(token)) {
        group.forEach((item) => terms.add(item));
      }
    }
  }

  return Array.from(terms);
}

function computeProjectMatchScore(project, queryText, semanticTerms) {
  const title = String(project?.title || '').toLowerCase();
  const description = String(project?.description || '').toLowerCase();
  const technologies = Array.isArray(project?.technologies)
    ? project.technologies.map((t) => String(t || '').toLowerCase()).join(' ')
    : '';

  const fullText = `${title} ${description} ${technologies}`.trim();
  if (!fullText) return 0;

  const queryLower = String(queryText || '').toLowerCase().trim();
  let score = 0;

  if (queryLower && fullText.includes(queryLower)) {
    score += 70;
  }

  for (const term of semanticTerms) {
    if (!term || term.length < 3) continue;
    if (title.includes(term)) score += 10;
    else if (description.includes(term)) score += 6;
    else if (technologies.includes(term)) score += 4;
  }

  const fuzzyTitle = bestFuzzySimilarity(title, queryLower);
  const fuzzyDescription = bestFuzzySimilarity(description, queryLower);
  const fuzzyTech = bestFuzzySimilarity(technologies, queryLower);
  const fuzzy = Math.max(fuzzyTitle, fuzzyDescription, fuzzyTech);

  if (fuzzy >= 0.88) score += 40;
  else if (fuzzy >= 0.76) score += 24;
  else if (fuzzy >= 0.66) score += 12;

  return score;
}

function calculateProfileStrength(user) {
  let score = 0;

  if (user.profilePicture) score += 20;
  if (Array.isArray(user.skills) && user.skills.length >= 3) score += 20;
  if (typeof user.bio === 'string' && user.bio.trim().length > 0) score += 20;
  if (Array.isArray(user.projects) && user.projects.length > 0) score += 20;
  if (user.cgpa !== null && user.cgpa !== undefined && user.cgpa !== '') score += 20;

  return score;
}

function normalizeTextArray(values) {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean);
}

const PEOPLE_CLUSTERS = {
  'ml-experts': {
    label: 'Machine Learning Experts',
    keywords: ['machine learning', 'ml', 'deep learning', 'tensorflow', 'pytorch', 'nlp', 'computer vision', 'scikit-learn', 'data science'],
  },
  'web-dev': {
    label: 'Web Developers',
    keywords: ['web development', 'frontend', 'backend', 'react', 'node', 'express', 'javascript', 'html', 'css', 'full stack'],
  },
  'app-dev': {
    label: 'App Developers',
    keywords: ['android', 'ios', 'mobile', 'flutter', 'react native', 'kotlin', 'swift'],
  },
  'data-analytics': {
    label: 'Data Analytics',
    keywords: ['analytics', 'data analysis', 'sql', 'power bi', 'tableau', 'excel', 'statistics', 'python'],
  },
  'open-source': {
    label: 'Open Source Contributors',
    keywords: ['open source', 'github', 'community', 'maintainer', 'contributor', 'hacktoberfest'],
  },
};

function computeClusterScore(user, keywords) {
  const skills = normalizeTextArray(user.skills);
  const interests = normalizeTextArray(user.interests);
  const projectTokens = Array.isArray(user.projects)
    ? user.projects.flatMap((project) => normalizeTextArray([
      project?.title,
      project?.description,
      ...(Array.isArray(project?.technologies) ? project.technologies : []),
    ]))
    : [];

  const haystack = [...skills, ...interests, ...projectTokens].join(' ');
  if (!haystack) return 0;

  let score = 0;
  for (const keyword of keywords) {
    const term = String(keyword || '').trim().toLowerCase();
    if (!term) continue;

    if (skills.some((s) => s.includes(term))) score += 8;
    else if (interests.some((i) => i.includes(term))) score += 6;
    else if (projectTokens.some((p) => p.includes(term))) score += 5;
    else if (haystack.includes(term)) score += 3;
  }

  return score;
}

function runPythonClusterRanking(payload) {
  const scriptPath = path.join(__dirname, '..', 'scripts', 'cluster_people.py');
  const commands = [
    ['python', [scriptPath]],
    ['py', ['-3', scriptPath]],
    ['py', [scriptPath]],
  ];

  let lastError = null;

  for (const [command, args] of commands) {
    try {
      const result = spawnSync(command, args, {
        input: JSON.stringify(payload),
        encoding: 'utf-8',
        timeout: 8000,
        maxBuffer: 1024 * 1024,
      });

      if (result.error) {
        lastError = result.error;
        continue;
      }

      if (result.status !== 0) {
        lastError = new Error((result.stderr || '').trim() || (result.stdout || '').trim() || `Python exited with code ${result.status}`);
        continue;
      }

      const parsed = JSON.parse(result.stdout || '{}');
      if (!parsed.success) {
        lastError = new Error(parsed.message || 'Python clustering failed');
        continue;
      }

      return parsed.ranked || [];
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Failed to execute Python clustering');
}

function normalizeMentorshipStatus(status) {
  return String(status || '').trim().toLowerCase();
}

function toFiniteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function computeMentorScoreFallback(stats) {
  const acceptedCount = toFiniteNumber(stats?.acceptedCount, 0);
  const rejectedCount = toFiniteNumber(stats?.rejectedCount, 0);
  const pendingCount = toFiniteNumber(stats?.pendingCount, 0);
  const totalRequests = Math.max(acceptedCount + rejectedCount + pendingCount, toFiniteNumber(stats?.totalRequests, 0));
  const respondedCount = acceptedCount + rejectedCount;

  const acceptanceRate = respondedCount > 0 ? (acceptedCount / respondedCount) : 0;
  const responseCoverage = totalRequests > 0 ? (respondedCount / totalRequests) : 0;
  const volumeNorm = Math.min(1, respondedCount / 12);

  const avgSatisfaction = Math.max(0, Math.min(5, toFiniteNumber(stats?.avgSatisfaction, 0)));
  const satisfactionNorm = avgSatisfaction / 5;
  const interactionsCount = toFiniteNumber(stats?.interactionsCount, 0);
  const engagementNorm = Math.min(1, interactionsCount / 20);

  const avgResponseHours = toFiniteNumber(stats?.avgResponseHours, 0);
  const speedNorm = avgResponseHours > 0
    ? Math.max(0, 1 - Math.min(avgResponseHours / 72, 1))
    : (respondedCount > 0 ? 0.5 : 0.2);

  const acceptanceBehaviorScore = (0.6 * acceptanceRate + 0.25 * responseCoverage + 0.15 * volumeNorm) * 100;
  const reactionBehaviorScore = (0.5 * satisfactionNorm + 0.3 * engagementNorm + 0.2 * speedNorm) * 100;
  const mentorScore = (0.6 * acceptanceBehaviorScore) + (0.4 * reactionBehaviorScore);
  const confidence = Math.min(1, (Math.min(1, respondedCount / 8) * 0.6) + (Math.min(1, interactionsCount / 15) * 0.4));

  return {
    mentorScore: Math.round(mentorScore * 100) / 100,
    acceptanceBehaviorScore: Math.round(acceptanceBehaviorScore * 100) / 100,
    reactionBehaviorScore: Math.round(reactionBehaviorScore * 100) / 100,
    confidence: Math.round(confidence * 1000) / 1000,
  };
}

function runPythonMentorScoring(payload) {
  const scriptPath = path.join(__dirname, '..', 'scripts', 'mentor_scoring.py');
  const commands = [
    ['python', [scriptPath]],
    ['py', ['-3', scriptPath]],
    ['py', [scriptPath]],
  ];

  let lastError = null;

  for (const [command, args] of commands) {
    try {
      const result = spawnSync(command, args, {
        input: JSON.stringify(payload),
        encoding: 'utf-8',
        timeout: 8000,
        maxBuffer: 1024 * 1024,
      });

      if (result.error) {
        lastError = result.error;
        continue;
      }

      if (result.status !== 0) {
        lastError = new Error((result.stderr || '').trim() || (result.stdout || '').trim() || `Python exited with code ${result.status}`);
        continue;
      }

      const parsed = JSON.parse(result.stdout || '{}');
      if (!parsed.success) {
        lastError = new Error(parsed.message || 'Python mentor scoring failed');
        continue;
      }

      return parsed.ranked || [];
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Failed to execute Python mentor scoring');
}

// @route   GET /api/users/profile/:id
// @desc    Get user profile by ID
// @access  Private
router.get('/profile/:id', verifyToken, apiLimiter, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('mentorRelationships')
      .populate('menteeRelationships');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const payload = user.toObject();
    const role = String(payload.role || '').toLowerCase();
    const isMentorRole = role === 'senior' || role === 'faculty';

    let mentorScorePayload = {
      mentorScore: null,
      acceptanceBehaviorScore: null,
      reactionBehaviorScore: null,
      scoringConfidence: null,
      mentorStats: null,
      mentorScoringSource: null,
    };

    if (isMentorRole) {
      const interactionWindowDays = 180;
      const mentorId = payload._id;

      const [mentorshipRecords, interactionRecords] = await Promise.all([
        Mentorship.find({ mentorId })
          .select('status requestedAt acceptedAt updatedAt')
          .lean(),
        Interaction.find({
          mentorId,
          timestamp: { $gte: new Date(Date.now() - (interactionWindowDays * 24 * 60 * 60 * 1000)) },
        })
          .select('satisfactionRating duration timestamp')
          .lean(),
      ]);

      const stats = {
        totalRequests: 0,
        acceptedCount: 0,
        rejectedCount: 0,
        pendingCount: 0,
        respondedCount: 0,
        avgResponseHours: 0,
        interactionsCount: 0,
        avgSatisfaction: 0,
        recentInteractionsCount: 0,
        avgInteractionDuration: 0,
      };

      const responseTimes = [];
      mentorshipRecords.forEach((record) => {
        const status = normalizeMentorshipStatus(record?.status);
        stats.totalRequests += 1;

        if (status === 'accepted') {
          stats.acceptedCount += 1;
          stats.respondedCount += 1;
        } else if (status === 'rejected') {
          stats.rejectedCount += 1;
          stats.respondedCount += 1;
        } else if (status === 'pending') {
          stats.pendingCount += 1;
        }

        if (status === 'accepted' || status === 'rejected') {
          const requestedAt = record?.requestedAt ? new Date(record.requestedAt) : null;
          const responseAt = status === 'accepted'
            ? (record?.acceptedAt ? new Date(record.acceptedAt) : (record?.updatedAt ? new Date(record.updatedAt) : null))
            : (record?.updatedAt ? new Date(record.updatedAt) : null);

          if (requestedAt && responseAt && responseAt > requestedAt) {
            const diffHours = (responseAt.getTime() - requestedAt.getTime()) / (1000 * 60 * 60);
            if (Number.isFinite(diffHours)) {
              responseTimes.push(diffHours);
            }
          }
        }
      });

      const ratings = [];
      const durations = [];
      const now = Date.now();
      const recentWindowMs = 30 * 24 * 60 * 60 * 1000;

      interactionRecords.forEach((record) => {
        stats.interactionsCount += 1;

        if (record?.timestamp && (now - new Date(record.timestamp).getTime()) <= recentWindowMs) {
          stats.recentInteractionsCount += 1;
        }

        if (Number.isFinite(record?.satisfactionRating)) {
          ratings.push(Number(record.satisfactionRating));
        }

        if (Number.isFinite(record?.duration) && Number(record.duration) >= 0) {
          durations.push(Number(record.duration));
        }
      });

      stats.avgResponseHours = responseTimes.length
        ? (responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length)
        : 0;
      stats.avgSatisfaction = ratings.length
        ? (ratings.reduce((sum, value) => sum + value, 0) / ratings.length)
        : 0;
      stats.avgInteractionDuration = durations.length
        ? (durations.reduce((sum, value) => sum + value, 0) / durations.length)
        : 0;

      let scoreSource = 'python';
      let scoreRow;

      try {
        const ranked = runPythonMentorScoring({
          mentors: [{
            id: String(mentorId),
            name: payload.name || 'Mentor',
            stats,
          }],
        });
        scoreRow = ranked[0] || computeMentorScoreFallback(stats);
      } catch (pythonError) {
        scoreSource = 'js_fallback';
        scoreRow = computeMentorScoreFallback(stats);
        console.warn('Python mentor scoring failed in profile route, using JS fallback:', pythonError.message);
      }

      mentorScorePayload = {
        mentorScore: toFiniteNumber(scoreRow?.mentorScore, 0),
        acceptanceBehaviorScore: toFiniteNumber(scoreRow?.acceptanceBehaviorScore, 0),
        reactionBehaviorScore: toFiniteNumber(scoreRow?.reactionBehaviorScore, 0),
        scoringConfidence: toFiniteNumber(scoreRow?.confidence, 0),
        mentorStats: {
          totalRequests: toFiniteNumber(stats.totalRequests, 0),
          acceptedCount: toFiniteNumber(stats.acceptedCount, 0),
          rejectedCount: toFiniteNumber(stats.rejectedCount, 0),
          pendingCount: toFiniteNumber(stats.pendingCount, 0),
          avgResponseHours: Math.round(toFiniteNumber(stats.avgResponseHours, 0) * 100) / 100,
          interactionsCount: toFiniteNumber(stats.interactionsCount, 0),
          avgSatisfaction: Math.round(toFiniteNumber(stats.avgSatisfaction, 0) * 100) / 100,
          recentInteractionsCount: toFiniteNumber(stats.recentInteractionsCount, 0),
        },
        mentorScoringSource: scoreSource,
      };
    }

    res.json({
      success: true,
      user: {
        ...payload,
        mentorshipIntent: payload.mentorshipIntent || 'seeking',
        availability: payload.availability || 'flexible',
        profileStrength: calculateProfileStrength(payload),
        ...mentorScorePayload,
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user profile',
      error: error.message
    });
  }
});

async function updateProfileHandler(req, res) {
  try {
    const {
      name,
      year,
      department,
      skills,
      interests,
      cgpa,
      bio,
      projects,
      mentorshipIntent,
      availability,
      githubUrl,
      projectLink,
    } = req.body;

    const allowedUpdates = {
      name,
      year,
      department,
      skills,
      interests,
      cgpa,
      bio,
      projects,
      mentorshipIntent,
      availability,
      githubUrl,
      projectLink,
    };
    
    // Remove undefined fields
    Object.keys(allowedUpdates).forEach(key => 
      allowedUpdates[key] === undefined && delete allowedUpdates[key]
    );

    if (allowedUpdates.skills !== undefined) {
      if (!Array.isArray(allowedUpdates.skills)) {
        return res.status(400).json({
          success: false,
          message: 'Skills must be an array',
        });
      }

      const normalizedSkills = normalizeSkills(allowedUpdates.skills);
      if (normalizedSkills.length > MAX_SKILLS) {
        return res.status(400).json({
          success: false,
          message: `Skills cannot exceed ${MAX_SKILLS} items`,
        });
      }

      allowedUpdates.skills = normalizedSkills;
    }

    if (allowedUpdates.bio !== undefined) {
      const nextBio = String(allowedUpdates.bio || '').trim();
      if (nextBio.length > 200) {
        return res.status(400).json({
          success: false,
          message: 'Bio cannot exceed 200 characters',
        });
      }

      if (nextBio && nextBio.length < 10) {
        return res.status(400).json({
          success: false,
          message: 'Bio must be at least 10 characters when provided',
        });
      }

      allowedUpdates.bio = nextBio;
    }

    if (allowedUpdates.githubUrl !== undefined) {
      allowedUpdates.githubUrl = String(allowedUpdates.githubUrl || '').trim();
    }

    if (allowedUpdates.projectLink !== undefined) {
      allowedUpdates.projectLink = String(allowedUpdates.projectLink || '').trim();
    }

    // Check if significant changes are being made
    const significantFields = ['name', 'year', 'department'];
    const hasSignificantChange = Object.keys(allowedUpdates).some(key => 
      significantFields.includes(key)
    );

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: allowedUpdates },
      { new: true, runValidators: true }
    ).select('-password');

    // Send notification email for significant profile changes
    if (hasSignificantChange) {
      const updateTime = new Date().toLocaleString('en-IN', { 
        timeZone: 'Asia/Kolkata',
        dateStyle: 'full',
        timeStyle: 'short'
      });

      const changedFields = Object.keys(allowedUpdates)
        .filter(key => significantFields.includes(key))
        .map(key => {
          const fieldName = key.charAt(0).toUpperCase() + key.slice(1);
          return `<li><strong>${fieldName}:</strong> ${allowedUpdates[key]}</li>`;
        })
        .join('');

      const profileUpdateHtml = `
        <h2>Profile Updated</h2>
        <p>Hello ${user.name},</p>
        <p>Your MentorLink profile was updated successfully.</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Time:</strong> ${updateTime}</p>
          <p style="margin: 5px 0 10px 0;"><strong>Changes made:</strong></p>
          <ul style="margin: 0; padding-left: 20px;">
            ${changedFields}
          </ul>
        </div>
        <p><strong>If you didn't make these changes, please contact support immediately.</strong></p>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e0e0e0;">
        <p style="color: #666; font-size: 0.9em;">This is an automated notification from MentorLink.</p>
      `;

      sendEmail({ 
        to: user.email, 
        subject: 'Your MentorLink Profile Was Updated', 
        html: profileUpdateHtml 
      }).catch(console.error);
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        ...user.toObject(),
        mentorshipIntent: user.mentorshipIntent || 'seeking',
        availability: user.availability || 'flexible',
        profileStrength: calculateProfileStrength(user),
      }
    });
  } catch (error) {
    if (error && error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors).map((entry) => entry.message).join('. '),
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message
    });
  }
}

// @route   PUT /api/users/profile
// @desc    Update own profile
// @access  Private
router.put('/profile', verifyToken, apiLimiter, updateProfileHandler);

// @route   PATCH /api/users/profile
// @desc    Partially update own profile
// @access  Private
router.patch('/profile', verifyToken, apiLimiter, updateProfileHandler);

// @route   GET /api/users/profile-completion
// @desc    Get profile completion percentage
// @access  Private
router.get('/profile-completion', verifyToken, apiLimiter, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Calculate profile completion
    let completionPercentage = 0;
    let missingFields = [];

    // Base fields (name, email always present) = 20%
    completionPercentage += 20;

    // Year = 10%
    if (user.year) {
      completionPercentage += 10;
    } else {
      missingFields.push('year');
    }

    // Skills (at least 1) = 15%
    if (user.skills && user.skills.length > 0) {
      completionPercentage += 15;
    } else {
      missingFields.push('skills');
    }

    // Interests (at least 1) = 15%
    if (user.interests && user.interests.length > 0) {
      completionPercentage += 15;
    } else {
      missingFields.push('interests');
    }

    // CGPA = 10%
    if (user.cgpa) {
      completionPercentage += 10;
    } else {
      missingFields.push('cgpa');
    }

    // Bio = 15%
    if (user.bio && user.bio.trim().length > 0) {
      completionPercentage += 15;
    } else {
      missingFields.push('bio');
    }

    // Projects (at least 1) = 15%
    if (user.projects && user.projects.length > 0) {
      completionPercentage += 15;
    } else {
      missingFields.push('projects');
    }

    res.json({
      success: true,
      completionPercentage,
      isComplete: completionPercentage === 100,
      missingFields
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to calculate profile completion',
      error: error.message
    });
  }
});

// @route   GET /api/users/mentors
// @desc    Get all mentors (seniors and faculty)
// @access  Private
router.get('/mentors', verifyToken, apiLimiter, async (req, res) => {
  try {
    const { department, subjectTag } = req.query;
    const includeScores = String(req.query.includeScores || 'true').toLowerCase() !== 'false';
    const interactionWindowDays = Math.max(30, Math.min(Number(req.query.interactionWindowDays) || 180, 365));
    
    const query = {
      role: { $in: ['senior', 'faculty'] },
      isActive: true,
      mentorshipIntent: { $in: ['offering', 'both'] },
    };

    if (department) {
      query.department = department;
    }

    const mentors = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();

    if (!includeScores || !mentors.length) {
      return res.json({
        success: true,
        count: mentors.length,
        mentors,
      });
    }

    const mentorIds = mentors.map((mentor) => mentor._id);
    const statsByMentorId = new Map(mentorIds.map((id) => [String(id), {
      totalRequests: 0,
      acceptedCount: 0,
      rejectedCount: 0,
      pendingCount: 0,
      respondedCount: 0,
      avgResponseHours: 0,
      interactionsCount: 0,
      avgSatisfaction: 0,
      recentInteractionsCount: 0,
      avgInteractionDuration: 0,
    }]));

    const mentorshipRecords = await Mentorship.find({
      mentorId: { $in: mentorIds },
    })
      .select('mentorId status requestedAt acceptedAt updatedAt')
      .lean();

    const responseTimeBuckets = new Map(mentorIds.map((id) => [String(id), []]));

    mentorshipRecords.forEach((record) => {
      const mentorId = String(record?.mentorId || '');
      if (!statsByMentorId.has(mentorId)) return;

      const stats = statsByMentorId.get(mentorId);
      const status = normalizeMentorshipStatus(record?.status);

      stats.totalRequests += 1;
      if (status === 'accepted') {
        stats.acceptedCount += 1;
        stats.respondedCount += 1;
      } else if (status === 'rejected') {
        stats.rejectedCount += 1;
        stats.respondedCount += 1;
      } else if (status === 'pending') {
        stats.pendingCount += 1;
      }

      if (status === 'accepted' || status === 'rejected') {
        const requestedAt = record?.requestedAt ? new Date(record.requestedAt) : null;
        const responseAt = status === 'accepted'
          ? (record?.acceptedAt ? new Date(record.acceptedAt) : (record?.updatedAt ? new Date(record.updatedAt) : null))
          : (record?.updatedAt ? new Date(record.updatedAt) : null);

        if (requestedAt && responseAt && responseAt > requestedAt) {
          const diffHours = (responseAt.getTime() - requestedAt.getTime()) / (1000 * 60 * 60);
          if (Number.isFinite(diffHours)) {
            responseTimeBuckets.get(mentorId).push(diffHours);
          }
        }
      }
    });

    const interactionQuery = {
      mentorId: { $in: mentorIds },
      timestamp: { $gte: new Date(Date.now() - (interactionWindowDays * 24 * 60 * 60 * 1000)) },
    };

    if (subjectTag) {
      interactionQuery.subjectTag = String(subjectTag);
    }

    const interactionRecords = await Interaction.find(interactionQuery)
      .select('mentorId satisfactionRating duration timestamp')
      .lean();

    const satisfactionBuckets = new Map(mentorIds.map((id) => [String(id), []]));
    const durationBuckets = new Map(mentorIds.map((id) => [String(id), []]));
    const now = Date.now();
    const recentWindowMs = 30 * 24 * 60 * 60 * 1000;

    interactionRecords.forEach((record) => {
      const mentorId = String(record?.mentorId || '');
      if (!statsByMentorId.has(mentorId)) return;

      const stats = statsByMentorId.get(mentorId);
      stats.interactionsCount += 1;

      if (record?.timestamp && (now - new Date(record.timestamp).getTime()) <= recentWindowMs) {
        stats.recentInteractionsCount += 1;
      }

      if (Number.isFinite(record?.satisfactionRating)) {
        satisfactionBuckets.get(mentorId).push(Number(record.satisfactionRating));
      }

      if (Number.isFinite(record?.duration) && Number(record.duration) >= 0) {
        durationBuckets.get(mentorId).push(Number(record.duration));
      }
    });

    statsByMentorId.forEach((stats, mentorId) => {
      const responseTimes = responseTimeBuckets.get(mentorId) || [];
      const ratings = satisfactionBuckets.get(mentorId) || [];
      const durations = durationBuckets.get(mentorId) || [];

      stats.avgResponseHours = responseTimes.length
        ? (responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length)
        : 0;
      stats.avgSatisfaction = ratings.length
        ? (ratings.reduce((sum, value) => sum + value, 0) / ratings.length)
        : 0;
      stats.avgInteractionDuration = durations.length
        ? (durations.reduce((sum, value) => sum + value, 0) / durations.length)
        : 0;
    });

    const payloadMentors = mentors.map((mentor) => ({
      id: String(mentor._id),
      name: mentor.name || 'Mentor',
      stats: statsByMentorId.get(String(mentor._id)) || {
        totalRequests: 0,
        acceptedCount: 0,
        rejectedCount: 0,
        pendingCount: 0,
        respondedCount: 0,
        avgResponseHours: 0,
        interactionsCount: 0,
        avgSatisfaction: 0,
        recentInteractionsCount: 0,
        avgInteractionDuration: 0,
      },
    }));

    let ranked;
    let scoreSource = 'python';

    try {
      ranked = runPythonMentorScoring({ mentors: payloadMentors });
    } catch (pythonError) {
      scoreSource = 'js_fallback';
      ranked = payloadMentors.map((entry) => ({
        id: entry.id,
        ...computeMentorScoreFallback(entry.stats),
      }));
      console.warn('Python mentor scoring failed, using JS fallback:', pythonError.message);
    }

    const scoreById = new Map(ranked.map((row) => [String(row.id), row]));

    const enrichedMentors = mentors
      .map((mentor) => {
        const mentorId = String(mentor._id);
        const scoreRow = scoreById.get(mentorId) || computeMentorScoreFallback(statsByMentorId.get(mentorId));
        const stats = statsByMentorId.get(mentorId) || {};

        return {
          ...mentor,
          mentorScore: toFiniteNumber(scoreRow.mentorScore, 0),
          acceptanceBehaviorScore: toFiniteNumber(scoreRow.acceptanceBehaviorScore, 0),
          reactionBehaviorScore: toFiniteNumber(scoreRow.reactionBehaviorScore, 0),
          scoringConfidence: toFiniteNumber(scoreRow.confidence, 0),
          mentorStats: {
            totalRequests: toFiniteNumber(stats.totalRequests, 0),
            acceptedCount: toFiniteNumber(stats.acceptedCount, 0),
            rejectedCount: toFiniteNumber(stats.rejectedCount, 0),
            pendingCount: toFiniteNumber(stats.pendingCount, 0),
            avgResponseHours: Math.round(toFiniteNumber(stats.avgResponseHours, 0) * 100) / 100,
            interactionsCount: toFiniteNumber(stats.interactionsCount, 0),
            avgSatisfaction: Math.round(toFiniteNumber(stats.avgSatisfaction, 0) * 100) / 100,
            recentInteractionsCount: toFiniteNumber(stats.recentInteractionsCount, 0),
          },
        };
      })
      .sort((a, b) => {
        if (b.mentorScore !== a.mentorScore) return b.mentorScore - a.mentorScore;
        if (b.scoringConfidence !== a.scoringConfidence) return b.scoringConfidence - a.scoringConfidence;
        return String(a.name || '').localeCompare(String(b.name || ''));
      });

    res.json({
      success: true,
      count: enrichedMentors.length,
      mentors: enrichedMentors,
      scoringMeta: {
        scoreSource,
        interactionWindowDays,
        scoringLogic: 'acceptance_behavior_plus_reaction_behavior',
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch mentors',
      error: error.message
    });
  }
});

// @route   GET /api/users/peers/recommendations
// @desc    Get peer-to-peer directional recommendations for logged in user
// @access  Private
router.get('/peers/recommendations', verifyToken, apiLimiter, async (req, res) => {
  const startedAt = Date.now();

  try {
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 10, 30));
    const includeBreakdown = String(req.query.includeBreakdown || 'false').toLowerCase() === 'true';
    const sameDepartmentOnly = String(req.query.sameDepartmentOnly || 'false').toLowerCase() === 'true';

    const targetUser = await User.findById(req.user._id)
      .select('_id name department year skills interests availability')
      .lean();

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const candidateQuery = {
      isActive: true,
      _id: { $ne: req.user._id },
    };

    if (sameDepartmentOnly && targetUser.department) {
      candidateQuery.department = targetUser.department;
    }

    const candidates = await User.find(candidateQuery)
      .select('_id name department year skills interests availability')
      .lean();

    const interactions = await Interaction.find({
      timestamp: { $gte: new Date(Date.now() - (180 * 24 * 60 * 60 * 1000)) },
    })
      .select('mentorId menteeId satisfactionRating timestamp')
      .lean();

    const result = buildPeerRecommendations({
      targetUser,
      candidates,
      interactions,
      topN: limit,
    });

    const peers = includeBreakdown
      ? result.recommendations
      : result.recommendations.map((row) => ({
        userId: row.userId,
        name: row.name,
        department: row.department,
        year: row.year,
        score: row.score,
      }));

    return res.json({
      success: true,
      count: peers.length,
      peers,
      recommendationMeta: {
        ...result.metadata,
        candidatePool: candidates.length,
        interactionWindowDays: 180,
        latencyMs: Date.now() - startedAt,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to generate peer recommendations',
      error: error.message,
    });
  }
});

// @route   POST /api/users/:id/follow
// @desc    Follow a user
// @access  Private
router.post('/:id/follow', verifyToken, apiLimiter, async (req, res) => {
  try {
    const targetId = req.params.id;

    if (targetId === String(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot follow yourself'
      });
    }

    const targetUser = await User.findById(targetId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await Promise.all([
      User.updateOne(
        { _id: req.user._id },
        { $addToSet: { following: targetUser._id } },
      ),
      User.updateOne(
        { _id: targetUser._id },
        { $addToSet: { followers: req.user._id } },
      ),
    ]);

    const updatedMe = await User.findById(req.user._id).select('followers following');
    const updatedTarget = await User.findById(targetUser._id).select('followers following');

    // Notify target user that someone started following them.
    try {
      const actor = await User.findById(req.user._id).select('name');
      const actorName = actor?.name || 'Someone';
      const io = req.app.get('io');

      await createAndEmitNotification({
        io,
        userId: targetUser._id,
        type: 'NEW_FOLLOWER',
        message: `${actorName} started following you`,
        relatedId: req.user._id,
      });
    } catch (notificationError) {
      // Non-blocking: follow should still succeed even if notification fails.
      console.error('Failed to create follow notification:', notificationError.message);
    }

    return res.json({
      success: true,
      message: 'Now following user',
      isFollowing: true,
      followerCount: updatedTarget.followers.length,
      followingCount: updatedMe.following.length,
      followingIds: (updatedMe.following || []).map((id) => String(id)),
      followerIds: (updatedTarget.followers || []).map((id) => String(id)),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to follow user',
      error: error.message,
    });
  }
});

// @route   POST /api/users/:id/unfollow
// @desc    Unfollow a user
// @access  Private
router.post('/:id/unfollow', verifyToken, apiLimiter, async (req, res) => {
  try {
    const targetId = req.params.id;

    const targetUser = await User.findById(targetId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await Promise.all([
      User.updateOne(
        { _id: req.user._id },
        { $pull: { following: targetUser._id } },
      ),
      User.updateOne(
        { _id: targetUser._id },
        { $pull: { followers: req.user._id } },
      ),
    ]);

    const updatedMe = await User.findById(req.user._id).select('followers following');
    const updatedTarget = await User.findById(targetUser._id).select('followers following');

    return res.json({
      success: true,
      message: 'Unfollowed user',
      isFollowing: false,
      followerCount: updatedTarget.followers.length,
      followingCount: updatedMe.following.length,
      followingIds: (updatedMe.following || []).map((id) => String(id)),
      followerIds: (updatedTarget.followers || []).map((id) => String(id)),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to unfollow user',
      error: error.message,
    });
  }
});

// @route   GET /api/users/juniors
// @desc    Get all juniors (for mentors to see potential mentees)
// @access  Private (Mentors only)
router.get('/juniors', verifyToken, checkRole('senior', 'faculty'), apiLimiter, async (req, res) => {
  try {
    const { department } = req.query;
    
    const query = {
      role: 'junior',
      isActive: true,
      $or: [
        { mentorshipIntent: { $in: ['seeking', 'both'] } },
        { mentorshipIntent: { $exists: false } },
        { mentorshipIntent: null },
      ],
    };

    if (department) {
      query.department = department;
    }

    const juniors = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: juniors.length,
      juniors
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch juniors',
      error: error.message
    });
  }
});

// @route   GET /api/users/profile-completion
// @desc    Get profile completion percentage
// @access  Private
router.get('/profile-completion', verifyToken, apiLimiter, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Calculate completion percentage
    let completionPercentage = 0;
    const missingFields = [];

    // Base fields (always present after registration)
    completionPercentage += 20; // name, email

    // Optional fields
    if (user.year) {
      completionPercentage += 10;
    } else {
      missingFields.push('year');
    }

    if (user.skills && user.skills.length > 0) {
      completionPercentage += 15;
    } else {
      missingFields.push('skills');
    }

    if (user.interests && user.interests.length > 0) {
      completionPercentage += 15;
    } else {
      missingFields.push('interests');
    }

    if (user.cgpa) {
      completionPercentage += 10;
    } else {
      missingFields.push('cgpa');
    }

    if (user.bio && user.bio.trim().length > 0) {
      completionPercentage += 15;
    } else {
      missingFields.push('bio');
    }

    if (user.projects && user.projects.length > 0) {
      completionPercentage += 15;
    } else {
      missingFields.push('projects');
    }

    res.json({
      success: true,
      completionPercentage,
      missingFields
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to calculate profile completion',
      error: error.message
    });
  }
});

// @route   GET /api/users/search
// @desc    Search users by name (partial, case-insensitive)
// @access  Private
router.get('/search', verifyToken, apiLimiter, async (req, res) => {
  try {
    const { q = '', limit = 10 } = req.query;
    const query = (q || '').trim();

    if (!query) {
      return res.json({ success: true, count: 0, users: [] });
    }

    const parsedLimit = Math.max(1, Math.min(parseInt(limit, 10) || 10, 30));
    const currentUser = await User.findById(req.user._id).select('following');
    const regex = new RegExp(query, 'i');

    const users = await User.find({
      _id: { $ne: req.user._id },
      isVerified: true,
      isActive: true,
    })
      .select('name email department year role profilePicture bio followers following isOnline lastActiveAt')
      .limit(250);

    const followingSet = new Set((currentUser.following || []).map((id) => String(id)));
    const queryLower = query.toLowerCase();

    const enriched = users
      .filter((u) => !isPlaceholderProfile(u))
      .map((u) => {
        const isFollowing = followingSet.has(String(u._id));
        return {
          id: u._id,
          _id: u._id,
          name: u.name,
          email: u.email,
          department: u.department,
          year: u.year,
          role: u.role,
          bio: u.bio,
          profilePicture: u.profilePicture,
          followersCount: (u.followers || []).length,
          followingCount: (u.following || []).length,
          isFollowing,
          isOnline: !!u.isOnline,
          lastActiveAt: u.lastActiveAt || null,
          _score: computeUserSearchScore(u, queryLower, isFollowing),
        };
      })
      .filter((row) => row._score > 0)
      .sort((a, b) => {
        if (b._score !== a._score) return b._score - a._score;
        if ((b.followersCount || 0) !== (a.followersCount || 0)) {
          return (b.followersCount || 0) - (a.followersCount || 0);
        }
        return String(a.name || '').localeCompare(String(b.name || ''));
      })
      .slice(0, parsedLimit)
      .map(({ _score, ...row }) => row);

    res.json({ success: true, count: enriched.length, users: enriched });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to search users',
      error: error.message,
    });
  }
});

// @route   GET /api/users/suggestions
// @desc    Get suggested users to follow/connect with, based only on shared interests
// @access  Private
router.get('/suggestions', verifyToken, apiLimiter, async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const parsedLimit = Math.max(1, Math.min(parseInt(limit, 10) || 10, 30));
    const currentUser = await User.findById(req.user._id).select('interests following department');
    const myInterests = Array.isArray(currentUser?.interests) ? currentUser.interests : [];
    const normalizedInterests = Array.from(
      new Set(
        myInterests
          .map((interest) => String(interest || '').trim().toLowerCase())
          .filter(Boolean)
      )
    );

    const baseQuery = {
      _id: { $ne: req.user._id },
      isVerified: true,
      isActive: true,
    };

    let strategy = 'shared_interests';
    let suggestions = [];

    if (normalizedInterests.length) {
      const interestMatchers = normalizedInterests.map(
        (interest) => new RegExp(`^${escapeRegex(interest)}$`, 'i')
      );

      suggestions = await User.find({
        ...baseQuery,
        interests: { $in: interestMatchers },
      })
        .select('name email department year role profilePicture bio isOnline lastActiveAt')
        .limit(parsedLimit * 5);

      suggestions = suggestions.filter((u) => !isPlaceholderProfile(u));
      suggestions = suggestions.slice(0, parsedLimit);

      // Shared-interest match can be sparse; top-up with global users to keep list populated.
      if (suggestions.length < parsedLimit) {
        strategy = 'shared_interests_with_topup';
        const excludedIds = new Set(suggestions.map((u) => String(u._id)));

        const topUp = await User.find(baseQuery)
          .select('name email department year role profilePicture bio isOnline lastActiveAt')
          .sort({ isOnline: -1, lastActiveAt: -1, createdAt: -1 })
          .limit(parsedLimit * 8);

        const filteredTopUp = topUp.filter((u) => {
          const id = String(u._id);
          return !excludedIds.has(id) && !isPlaceholderProfile(u);
        });

        suggestions = [...suggestions, ...filteredTopUp].slice(0, parsedLimit);
      }
    }

    // Graceful fallback: if no shared-interest matches, suggest active verified peers in same department.
    if (!suggestions.length) {
      strategy = 'department_fallback';

      const fallbackQuery = {
        ...baseQuery,
      };

      if (currentUser?.department) {
        fallbackQuery.department = currentUser.department;
      }

      suggestions = await User.find(fallbackQuery)
        .select('name email department year role profilePicture bio isOnline lastActiveAt')
        .sort({ isOnline: -1, lastActiveAt: -1, createdAt: -1 })
        .limit(parsedLimit * 5);

      suggestions = suggestions.filter((u) => !isPlaceholderProfile(u));

      // If department fallback is too narrow, top-up from global verified users.
      if (suggestions.length < parsedLimit) {
        const excludedIds = new Set(suggestions.map((u) => String(u._id)));

        const topUp = await User.find(baseQuery)
          .select('name email department year role profilePicture bio isOnline lastActiveAt')
          .sort({ isOnline: -1, lastActiveAt: -1, createdAt: -1 })
          .limit(parsedLimit * 8);

        const filteredTopUp = topUp.filter((u) => {
          const id = String(u._id);
          return !excludedIds.has(id) && !isPlaceholderProfile(u);
        });

        suggestions = [...suggestions, ...filteredTopUp].slice(0, parsedLimit);
      } else {
        suggestions = suggestions.slice(0, parsedLimit);
      }
    }

    const followingSet = new Set((currentUser.following || []).map(id => String(id)));

    const enriched = suggestions.map((u) => ({
      id: u._id,
      _id: u._id,
      name: u.name,
      email: u.email,
      department: u.department,
      year: u.year,
      role: u.role,
      bio: u.bio,
      profilePicture: u.profilePicture,
      isFollowing: followingSet.has(String(u._id)),
      isOnline: !!u.isOnline,
      lastActiveAt: u.lastActiveAt || null,
    }));

    res.json({
      success: true,
      count: enriched.length,
      users: enriched,
      strategy,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch suggestions',
      error: error.message
    });
  }
});

// @route   GET /api/users/projects/search
// @desc    Search users by project intent/topic using semantic terms and fuzzy matching
// @access  Private
router.get('/projects/search', verifyToken, apiLimiter, async (req, res) => {
  try {
    const { q = '', limit = 12 } = req.query;
    const query = String(q || '').trim();

    if (!query) {
      return res.json({
        success: true,
        query,
        exists: false,
        userCount: 0,
        projectCount: 0,
        users: [],
      });
    }

    const parsedLimit = Math.max(1, Math.min(parseInt(limit, 10) || 12, 30));
    const semanticTerms = expandSemanticTerms(query);

    const users = await User.find({
      _id: { $ne: req.user._id },
      isVerified: true,
      isActive: true,
      projects: { $exists: true, $ne: [] },
    })
      .select('name email department year role profilePicture isOnline lastActiveAt projects')
      .limit(250)
      .lean();

    const ranked = users
      .filter((user) => !isPlaceholderProfile(user))
      .map((user) => {
        const projects = Array.isArray(user.projects) ? user.projects : [];

        const matchedProjects = projects
          .map((project) => {
            const score = computeProjectMatchScore(project, query, semanticTerms);
            return {
              title: project?.title || 'Untitled project',
              description: project?.description || '',
              technologies: Array.isArray(project?.technologies) ? project.technologies : [],
              score,
            };
          })
          .filter((entry) => entry.score >= 18)
          .sort((a, b) => b.score - a.score)
          .slice(0, 3);

        const bestScore = matchedProjects.length ? matchedProjects[0].score : 0;

        return {
          id: user._id,
          _id: user._id,
          name: user.name,
          email: user.email,
          department: user.department,
          year: user.year,
          role: user.role,
          profilePicture: user.profilePicture,
          isOnline: !!user.isOnline,
          lastActiveAt: user.lastActiveAt || null,
          matchedProjects,
          _bestScore: bestScore,
        };
      })
      .filter((row) => row._bestScore > 0)
      .sort((a, b) => {
        if (b._bestScore !== a._bestScore) return b._bestScore - a._bestScore;
        if ((b.matchedProjects?.length || 0) !== (a.matchedProjects?.length || 0)) {
          return (b.matchedProjects?.length || 0) - (a.matchedProjects?.length || 0);
        }
        return String(a.name || '').localeCompare(String(b.name || ''));
      })
      .slice(0, parsedLimit)
      .map(({ _bestScore, ...row }) => row);

    const projectCount = ranked.reduce((total, user) => total + (user.matchedProjects?.length || 0), 0);

    return res.json({
      success: true,
      query,
      exists: ranked.length > 0,
      userCount: ranked.length,
      projectCount,
      users: ranked,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to search projects',
      error: error.message,
    });
  }
});

// @route   GET /api/users/clusters
// @desc    Find people grouped by skill/project clusters (MVP)
// @access  Private
router.get('/clusters', verifyToken, apiLimiter, async (req, res) => {
  try {
    const { cluster = 'ml-experts', limit = 15 } = req.query;
    const clusterKey = String(cluster || 'ml-experts').toLowerCase();
    const clusterConfig = PEOPLE_CLUSTERS[clusterKey];

    if (!clusterConfig) {
      return res.status(400).json({
        success: false,
        message: 'Invalid cluster key',
        availableClusters: Object.keys(PEOPLE_CLUSTERS),
      });
    }

    const parsedLimit = Math.max(1, Math.min(parseInt(limit, 10) || 15, 40));
    const me = await User.findById(req.user._id).select('following');
    const followingSet = new Set((me?.following || []).map((id) => String(id)));

    const users = await User.find({
      _id: { $ne: req.user._id },
      isVerified: true,
      isActive: true,
    })
      .select('name email department year role profilePicture skills interests projects isOnline lastActiveAt')
      .limit(300)
      .lean();

    const prepared = users.filter((user) => !isPlaceholderProfile(user)).map((user) => {
      const topProject = Array.isArray(user.projects) && user.projects.length > 0
        ? user.projects[0]
        : null;

      return {
        id: user._id,
        _id: user._id,
        name: user.name,
        email: user.email,
        department: user.department,
        year: user.year,
        role: user.role,
        profilePicture: user.profilePicture,
        skills: user.skills || [],
        interests: user.interests || [],
        projects: user.projects || [],
        isFollowing: followingSet.has(String(user._id)),
        isOnline: !!user.isOnline,
        lastActiveAt: user.lastActiveAt || null,
        topProject: topProject
          ? {
            title: topProject.title || '',
            description: topProject.description || '',
            technologies: Array.isArray(topProject.technologies) ? topProject.technologies : [],
          }
          : null,
      };
    });

    let ranked = [];

    try {
      ranked = runPythonClusterRanking({
        clusterKey,
        clusterConfig,
        limit: parsedLimit,
        entries: prepared,
      }).map(({ _score, ...entry }) => entry);
    } catch (pythonError) {
      // Keep API resilient if python is unavailable in current environment.
      console.warn('Python clustering failed, using JS fallback:', pythonError.message);

      ranked = prepared
        .map((entry) => ({
          ...entry,
          _score: computeClusterScore(entry, clusterConfig.keywords),
        }))
        .filter((entry) => entry._score >= 6)
        .sort((a, b) => {
          if (b._score !== a._score) return b._score - a._score;
          if ((b.skills?.length || 0) !== (a.skills?.length || 0)) return (b.skills?.length || 0) - (a.skills?.length || 0);
          return String(a.name || '').localeCompare(String(b.name || ''));
        })
        .slice(0, parsedLimit)
        .map(({ _score, projects, ...entry }) => entry);
    }

    return res.json({
      success: true,
      cluster: clusterKey,
      clusterLabel: clusterConfig.label,
      count: ranked.length,
      people: ranked,
      availableClusters: Object.entries(PEOPLE_CLUSTERS).map(([key, value]) => ({ key, label: value.label })),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to cluster users',
      error: error.message,
    });
  }
});

// @route   GET /api/users/:id
// @desc    Get user by id with computed profile strength
// @access  Private
router.get('/:id', verifyToken, apiLimiter, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password').lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    return res.json({
      success: true,
      user: {
        ...user,
        mentorshipIntent: user.mentorshipIntent || 'seeking',
        availability: user.availability || 'flexible',
        profileStrength: calculateProfileStrength(user),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch user',
      error: error.message,
    });
  }
});

module.exports = router;
