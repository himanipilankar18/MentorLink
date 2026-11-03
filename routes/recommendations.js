const express = require('express');
const http = require('http');
const https = require('https');
const User = require('../models/User');
const Interaction = require('../models/Interaction');
const Mentorship = require('../models/Mentorship');
const Achievement = require('../models/Achievement');
const Group = require('../models/Group');
const ChatMessage = require('../models/ChatMessage');
const DemoMentoringEvidence = require('../models/DemoMentoringEvidence');
const { verifyToken } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/security');
const { generateMentorRecommendations } = require('../utils/recommendationEngine');
const externalRecommendationWeights = require('../config/externalRecommendationWeights');
const RecommendationLog = require('../models/RecommendationLog');
const { logRecommendationImpression, recordRecommendationEvent, trackSafely } = require('../utils/recommendationTracking');
const { COUNTED_EVIDENCE } = require('../utils/evidencePolicy');

const router = express.Router();

// Events the browser may report. Requests, accepts and rejects are recorded by the server itself.
const CLIENT_FEEDBACK_EVENTS = new Set(['viewed_details', 'opened_profile', 'helpful', 'not_helpful']);

function requestPythonRecommendations(payload) {
  const serviceUrl = process.env.RECOMMENDATION_SERVICE_URL;
  if (!serviceUrl) return Promise.resolve(null);
  const timeoutMs = Number.parseInt(process.env.RECOMMENDATION_SERVICE_TIMEOUT_MS || '15000', 10);
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    return Promise.reject(new Error('RECOMMENDATION_SERVICE_TIMEOUT_MS must be a positive integer'));
  }

  return new Promise((resolve, reject) => {
    const target = new URL('/recommend', serviceUrl);
    const client = target.protocol === 'https:' ? https : http;
    const request = client.request(target, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      timeout: timeoutMs,
    }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`Python recommendation service returned HTTP ${response.statusCode}: ${body}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(new Error(`Python recommendation service returned invalid JSON: ${error.message}`));
        }
      });
    });
    request.on('timeout', () => request.destroy(new Error('Python recommendation service timed out')));
    request.on('error', reject);
    request.write(JSON.stringify(payload));
    request.end();
  });
}

function parseLimit(input, fallback = 10) {
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(50, Math.floor(parsed)));
}

function normalizeStatus(status) {
  if (!status || typeof status !== 'string') return '';
  return status.toLowerCase();
}

function isExternalUser(user) {
  return String(user?.userType || '').toUpperCase() === 'EXTERNAL';
}

function externalMentorEligibilityQuery(userId) {
  return {
    _id: { $ne: userId },
    isActive: true,
    role: { $in: ['senior', 'faculty'] },
    availableForExternalGuidance: true,
    externalGuidanceLockedUntil: { $gt: new Date() },
  };
}

async function fetchMentorshipStats(mentorIds) {
  if (!mentorIds.length) return [];

  return Mentorship.aggregate([
    {
      $match: {
        mentorId: { $in: mentorIds },
      },
    },
    {
      $group: {
        _id: {
          mentorId: '$mentorId',
          status: '$status',
        },
        count: { $sum: 1 },
      },
    },
  ]);
}

async function fetchInteractionStats(mentorIds) {
  if (!mentorIds.length) return [];

  return Interaction.aggregate([
    {
      $match: {
        mentorId: { $in: mentorIds },
        ...COUNTED_EVIDENCE,
      },
    },
    {
      $group: {
        _id: '$mentorId',
        totalInteractions: { $sum: 1 },
        avgSatisfaction: { $avg: '$satisfactionRating' },
        ratingCount: {
          $sum: {
            $cond: [
              { $and: [{ $gte: ['$satisfactionRating', 1] }, { $lte: ['$satisfactionRating', 5] }] },
              1,
              0,
            ],
          },
        },
        subjectBreadth: { $addToSet: '$subjectTag' },
        uniqueMentees: { $addToSet: '$menteeId' },
        resolvedInteractions: {
          $sum: { $cond: [{ $eq: ['$outcomeStatus', 'resolved'] }, 1, 0] },
        },
        verifiedCompletedSessions: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $eq: ['$outcomeStatus', 'resolved'] },
                  { $eq: ['$followUpCompleted', true] },
                ],
              },
              1,
              0,
            ],
          },
        },
        lastInteractionAt: { $max: '$timestamp' },
        recommendYes: { $sum: { $cond: [{ $eq: ['$menteeWouldRecommend', true] }, 1, 0] } },
        recommendAnswers: {
          $sum: { $cond: [{ $in: ['$menteeWouldRecommend', [true, false]] }, 1, 0] },
        },
      },
    },
    {
      $project: {
        totalInteractions: 1,
        avgSatisfaction: { $ifNull: ['$avgSatisfaction', 0] },
        ratingCount: 1,
        subjectBreadth: { $size: '$subjectBreadth' },
        uniqueMentees: { $size: '$uniqueMentees' },
        resolvedInteractions: 1,
        verifiedCompletedSessions: 1,
        lastInteractionAt: 1,
        recommendYes: 1,
        recommendAnswers: 1,
      },
    },
  ]);
}

async function fetchAcademicSocialisationStats(seekerId, mentorIds) {
  if (!seekerId || !mentorIds.length) return {};

  const groups = await Group.find({
    isActive: true,
    $and: [
      { members: { $elemMatch: { userId: seekerId } } },
      { members: { $elemMatch: { userId: { $in: mentorIds } } } },
    ],
  }).select('_id members').lean();
  if (!groups.length) return {};

  const mentorIdSet = new Set(mentorIds.map((id) => String(id)));
  const stats = new Map();
  groups.forEach((group) => {
    group.members
      .map((member) => String(member.userId))
      .filter((memberId) => mentorIdSet.has(memberId))
      .forEach((mentorId) => {
        const current = stats.get(mentorId) || {
          sharedGroupCount: 0,
          candidateMessageCount: 0,
          lastChatAt: null,
        };
        current.sharedGroupCount += 1;
        stats.set(mentorId, current);
      });
  });

  const messages = await ChatMessage.aggregate([
    { $match: { groupId: { $in: groups.map((group) => group._id) } } },
    {
      $group: {
        _id: { groupId: '$groupId', senderId: '$senderId' },
        candidateMessageCount: { $sum: 1 },
        lastChatAt: { $max: '$createdAt' },
      },
    },
  ]);
  messages.forEach((message) => {
    const mentorId = String(message._id.senderId);
    if (!mentorIdSet.has(mentorId)) return;
    const current = stats.get(mentorId) || {
      sharedGroupCount: 0,
      candidateMessageCount: 0,
      lastChatAt: null,
    };
    current.candidateMessageCount += Number(message.candidateMessageCount || 0);
    if (!current.lastChatAt || new Date(message.lastChatAt) > new Date(current.lastChatAt)) {
      current.lastChatAt = message.lastChatAt;
    }
    stats.set(mentorId, current);
  });

  return Object.fromEntries(stats);
}

async function fetchAchievementStats(mentorIds) {
  if (!mentorIds.length) return [];

  return Achievement.aggregate([
    { $match: { mentorId: { $in: mentorIds } } },
    {
      $group: {
        _id: '$mentorId',
        achievementLevel: { $max: '$level' },
        achievementPoints: { $max: '$pointsAtAward' },
        achievementInteractions: { $max: '$confirmedInteractions' },
        achievementMentees: { $max: '$uniqueMentees' },
        achievementRating: { $max: '$averageRating' },
        achievementTitles: { $addToSet: '$title' },
        achievementCount: { $sum: 1 },
      },
    },
  ]);
}

async function fetchDemoMentoringEvidence(mentorIds) {
  if (process.env.DEMO_RECOMMENDATIONS !== 'true' || !mentorIds.length) return [];
  return DemoMentoringEvidence.find({ mentorId: { $in: mentorIds }, demoOnly: true })
    .select('-__v')
    .lean();
}

function mergeDemoEvidence(interactionStats, achievementStats, demoEvidence) {
  const demoByMentor = new Map(demoEvidence.map((row) => [String(row.mentorId), row]));
  const mergedInteractions = interactionStats.map((row) => {
    const key = String(row._id);
    const demo = demoByMentor.get(key);
    if (!demo) return row;
    const realRatings = Number(row.ratingCount || 0);
    const demoRatings = Number(demo.ratingCount || 0);
    const ratingTotal = realRatings + demoRatings;
    const lastDates = [row.lastInteractionAt, demo.lastInteractionAt].filter(Boolean).map((d) => new Date(d));
    return {
      ...row,
      totalInteractions: Number(row.totalInteractions || 0) + Number(demo.totalInteractions || 0),
      avgSatisfaction: ratingTotal
        ? (Number(row.avgSatisfaction || 0) * realRatings + Number(demo.avgSatisfaction || 0) * demoRatings) / ratingTotal
        : Number(demo.avgSatisfaction || row.avgSatisfaction || 0),
      ratingCount: ratingTotal,
      subjectBreadth: Math.max(Number(row.subjectBreadth || 0), Number(demo.subjectBreadth || 0)),
      uniqueMentees: Number(row.uniqueMentees || 0) + Number(demo.uniqueMentees || 0),
      resolvedInteractions: Number(row.resolvedInteractions || 0) + Number(demo.resolvedInteractions || 0),
      verifiedCompletedSessions: Number(row.verifiedCompletedSessions || 0) + Number(demo.verifiedCompletedSessions || 0),
      lastInteractionAt: lastDates.length ? new Date(Math.max(...lastDates)) : null,
      demoOnly: true,
    };
  });
  const known = new Set(mergedInteractions.map((row) => String(row._id)));
  demoEvidence.forEach((demo) => {
    const key = String(demo.mentorId);
    if (!known.has(key)) {
      mergedInteractions.push({
        _id: demo.mentorId,
        totalInteractions: demo.totalInteractions,
        avgSatisfaction: demo.avgSatisfaction,
        ratingCount: demo.ratingCount,
        subjectBreadth: demo.subjectBreadth,
        uniqueMentees: demo.uniqueMentees,
        resolvedInteractions: demo.resolvedInteractions,
        verifiedCompletedSessions: demo.verifiedCompletedSessions,
        lastInteractionAt: demo.lastInteractionAt,
        demoOnly: true,
      });
    }
  });
  const mergedAchievements = [
    ...achievementStats,
    ...demoEvidence.map((demo) => ({
      _id: demo.mentorId,
      achievementLevel: demo.achievementLevel,
      achievementInteractions: demo.achievementInteractions,
      achievementMentees: demo.achievementMentees,
      achievementRating: demo.achievementRating,
      demoOnly: true,
    })),
  ];
  const mentorships = demoEvidence.map((demo) => ({
    _id: { mentorId: demo.mentorId, status: 'accepted' },
    count: Number(demo.acceptedMentorships || 0),
    demoOnly: true,
  }));
  return { interactions: mergedInteractions, achievements: mergedAchievements, mentorships };
}

async function fetchBlockedMentorIds(menteeId) {
  const relationships = await Mentorship.find({
    menteeId,
    status: { $in: ['pending', 'accepted', 'Pending', 'Accepted'] },
  }).select('mentorId status');

  return new Set(
    relationships
      .filter((entry) => {
        const status = normalizeStatus(entry.status);
        return status === 'pending' || status === 'accepted';
      })
      .map((entry) => String(entry.mentorId)),
  );
}

// @route   GET /api/recommendations/mentors
// @desc    Get personalized ML-clustered mentor recommendations
// @access  Private
router.get('/mentors', verifyToken, apiLimiter, async (req, res) => {
  try {
    const userId = req.user._id;
    const limit = parseLimit(req.query.limit, 10);
    const { department } = req.query;

    const mentee = await User.findById(userId).select('-password').lean();
    if (!mentee) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (!['junior', 'faculty', 'senior', 'admin'].includes(String(mentee.role || '').toLowerCase())) {
      return res.status(403).json({
        success: false,
        message: 'Role not allowed to fetch recommendations',
      });
    }

    const mentorQuery = isExternalUser(mentee)
      ? externalMentorEligibilityQuery(userId)
      : {
        _id: { $ne: userId },
        isActive: true,
        mentorshipIntent: { $in: ['offering', 'both'] },
      };

    // Department is treated as a soft preference signal for scoring, not a hard eligibility requirement.
    const candidateMentors = await User.find(mentorQuery)
      .select('-password')
      .lean();

    // No seniority rule: anyone who offers mentorship can mentor anyone, in any year.
    const mentors = candidateMentors;

    const mentorIds = mentors.map((mentor) => mentor._id);
    const [interactionStats, mentorshipStats, achievementStats, demoEvidence, blockedMentorIds, academicSocialisation] = await Promise.all([
      fetchInteractionStats(mentorIds),
      fetchMentorshipStats(mentorIds),
      fetchAchievementStats(mentorIds),
      fetchDemoMentoringEvidence(mentorIds),
      fetchBlockedMentorIds(userId),
      fetchAcademicSocialisationStats(userId, mentorIds),
    ]);
    const mergedEvidence = mergeDemoEvidence(interactionStats, achievementStats, demoEvidence);

    const version = process.env.RECOMMENDATION_ENGINE_VERSION || 'v1';
    const pythonResult = await requestPythonRecommendations({
      seeker: mentee,
      candidates: mentors,
      interactions: mergedEvidence.interactions,
      achievements: mergedEvidence.achievements,
      mentorships: [...mentorshipStats, ...mergedEvidence.mentorships],
      version,
      options: {
        limit,
        weightProfile: isExternalUser(mentee) ? 'external' : 'internal',
        excludedMentorIds: Array.from(blockedMentorIds),
        demoEvidence: demoEvidence.length > 0,
        academicSocialisation,
      },
    });
    const result = pythonResult || generateMentorRecommendations({
      mentee,
      mentors,
      interactionStats,
      mentorshipStats,
      excludedMentorIds: blockedMentorIds,
      limit,
      scoreWeights: isExternalUser(mentee) ? externalRecommendationWeights : null,
    });

    const recommendations = result.recommendations.map((recommendation) => {
      const {
        externalGuidanceLockedUntil,
        externalGuidanceTermsVersion,
        externalGuidanceTermsAcceptedAt,
        termsVersion,
        ...safeRecommendation
      } = recommendation;
      if (!isExternalUser(req.user)) return safeRecommendation;
      return safeRecommendation;
    });

    // Record exactly what was shown, so later requests and feedback can be traced to a rank.
    const recommendationLogId = await trackSafely(logRecommendationImpression({
      seekerId: userId,
      recommendations,
      engine: pythonResult ? 'python' : 'js',
      engineVersion: pythonResult ? version : 'js-fallback',
      demoEvidence: demoEvidence.length > 0,
      candidateCount: mentors.length,
    }));

    res.json({
      success: true,
      count: recommendations.length,
      recommendations,
      clustering: result.clustering,
      recommendationLogId,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate mentor recommendations',
      error: error.message,
    });
  }
});

// @route   GET /api/recommendations/mentors/:mentorId/explain
// @desc    Explain recommendation score for a specific mentor
// @access  Private
router.get('/mentors/:mentorId/explain', verifyToken, apiLimiter, async (req, res) => {
  try {
    const userId = req.user._id;
    const { mentorId } = req.params;

    const mentee = await User.findById(userId).select('-password').lean();
    if (!mentee) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const mentor = await User.findOne(isExternalUser(mentee)
      ? { ...externalMentorEligibilityQuery(userId), _id: mentorId }
      : {
        _id: mentorId,
        isActive: true,
        mentorshipIntent: { $in: ['offering', 'both'] },
      }).select('-password').lean();

    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: 'Mentor not found',
      });
    }

    const [interactionStats, mentorshipStats, achievementStats, demoEvidence, blockedMentorIds, academicSocialisation] = await Promise.all([
      fetchInteractionStats([mentor._id]),
      fetchMentorshipStats([mentor._id]),
      fetchAchievementStats([mentor._id]),
      fetchDemoMentoringEvidence([mentor._id]),
      fetchBlockedMentorIds(userId),
      fetchAcademicSocialisationStats(userId, [mentor._id]),
    ]);
    const mergedEvidence = mergeDemoEvidence(interactionStats, achievementStats, demoEvidence);

    const version = process.env.RECOMMENDATION_ENGINE_VERSION || 'v1';
    const pythonResult = await requestPythonRecommendations({
      seeker: mentee,
      candidates: [mentor],
      interactions: mergedEvidence.interactions,
      achievements: mergedEvidence.achievements,
      mentorships: [...mentorshipStats, ...mergedEvidence.mentorships],
      version,
      options: {
        limit: 1,
        weightProfile: isExternalUser(mentee) ? 'external' : 'internal',
        excludedMentorIds: Array.from(blockedMentorIds),
        demoEvidence: demoEvidence.length > 0,
        academicSocialisation,
      },
    });
    const result = pythonResult || generateMentorRecommendations({
      mentee,
      mentors: [mentor],
      interactionStats,
      mentorshipStats,
      excludedMentorIds: blockedMentorIds,
      limit: 1,
      scoreWeights: isExternalUser(mentee) ? externalRecommendationWeights : null,
    });

    const explanation = result.recommendations[0];
    if (!explanation) {
      return res.status(404).json({
        success: false,
        message: 'No active recommendation for this mentor. You may already have an active/pending mentorship.',
      });
    }

    const {
      externalGuidanceLockedUntil,
      externalGuidanceTermsVersion,
      externalGuidanceTermsAcceptedAt,
      termsVersion,
      ...safeExplanation
    } = explanation;
    if (isExternalUser(req.user)) {
      // External viewers may see only the public opt-in indicator, never consent metadata.
    }

    res.json({
      success: true,
      recommendation: safeExplanation,
      clustering: result.clustering,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to explain recommendation score',
      error: error.message,
    });
  }
});

// @route   POST /api/recommendations/feedback
// @desc    Record what a user did with a recommended mentor (views, helpful / not helpful)
// @access  Private
router.post('/feedback', verifyToken, apiLimiter, async (req, res) => {
  try {
    const { recommendationLogId, mentorId, type } = req.body || {};
    if (!CLIENT_FEEDBACK_EVENTS.has(type)) {
      return res.status(400).json({ success: false, message: 'Unknown feedback type' });
    }
    if (!mentorId || !/^[a-f0-9]{24}$/i.test(String(mentorId))) {
      return res.status(400).json({ success: false, message: 'Invalid mentor ID' });
    }
    const logId = recommendationLogId && /^[a-f0-9]{24}$/i.test(String(recommendationLogId))
      ? recommendationLogId
      : null;

    // "Helpful" is a single choice per shown list: replace any earlier vote for this mentor.
    if (logId && (type === 'helpful' || type === 'not_helpful')) {
      await RecommendationLog.updateOne(
        { _id: logId, seekerId: req.user._id },
        { $pull: { events: { mentorId, type: { $in: ['helpful', 'not_helpful'] } } } },
      );
    }

    const recorded = await recordRecommendationEvent({
      seekerId: req.user._id,
      mentorId,
      type,
      logId,
    });
    res.json({ success: true, recorded });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to record feedback', error: error.message });
  }
});

router.requestPythonRecommendations = requestPythonRecommendations;

module.exports = router;
