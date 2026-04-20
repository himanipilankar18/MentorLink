const express = require('express');
const User = require('../models/User');
const Interaction = require('../models/Interaction');
const Mentorship = require('../models/Mentorship');
const { verifyToken } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/security');
const { generateMentorRecommendations } = require('../utils/recommendationEngine');

const router = express.Router();

function parseLimit(input, fallback = 10) {
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(50, Math.floor(parsed)));
}

function normalizeStatus(status) {
  if (!status || typeof status !== 'string') return '';
  return status.toLowerCase();
}

function isPotentialMentorForMentee(mentee, candidate) {
  const candidateRole = String(candidate.role || '').toLowerCase();
  if (candidateRole === 'faculty' || candidateRole === 'admin') return true;

  const menteeYear = Number(mentee.year);
  const candidateYear = Number(candidate.year);
  if (!Number.isFinite(menteeYear) || !Number.isFinite(candidateYear)) return false;

  return candidateYear > menteeYear;
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
      },
    },
    {
      $group: {
        _id: '$mentorId',
        totalInteractions: { $sum: 1 },
        avgSatisfaction: { $avg: '$satisfactionRating' },
        subjectBreadth: { $addToSet: '$subjectTag' },
        lastInteractionAt: { $max: '$timestamp' },
      },
    },
    {
      $project: {
        totalInteractions: 1,
        avgSatisfaction: { $ifNull: ['$avgSatisfaction', 0] },
        subjectBreadth: { $size: '$subjectBreadth' },
        lastInteractionAt: 1,
      },
    },
  ]);
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

    const mentorQuery = {
      _id: { $ne: userId },
      isActive: true,
      mentorshipIntent: { $in: ['offering', 'both'] },
    };

    if (department) {
      mentorQuery.department = department;
    }

    const candidateMentors = await User.find(mentorQuery)
      .select('-password')
      .lean();

    const mentors = candidateMentors.filter((candidate) => isPotentialMentorForMentee(mentee, candidate));

    const mentorIds = mentors.map((mentor) => mentor._id);
    const [interactionStats, mentorshipStats, blockedMentorIds] = await Promise.all([
      fetchInteractionStats(mentorIds),
      fetchMentorshipStats(mentorIds),
      fetchBlockedMentorIds(userId),
    ]);

    const result = generateMentorRecommendations({
      mentee,
      mentors,
      interactionStats,
      mentorshipStats,
      excludedMentorIds: blockedMentorIds,
      limit,
    });

    res.json({
      success: true,
      count: result.recommendations.length,
      recommendations: result.recommendations,
      clustering: result.clustering,
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

    const mentor = await User.findOne({
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

    if (!isPotentialMentorForMentee(mentee, mentor)) {
      return res.status(400).json({
        success: false,
        message: 'Selected user is not an eligible mentor for this mentee relationship',
      });
    }

    const [interactionStats, mentorshipStats, blockedMentorIds] = await Promise.all([
      fetchInteractionStats([mentor._id]),
      fetchMentorshipStats([mentor._id]),
      fetchBlockedMentorIds(userId),
    ]);

    const result = generateMentorRecommendations({
      mentee,
      mentors: [mentor],
      interactionStats,
      mentorshipStats,
      excludedMentorIds: blockedMentorIds,
      limit: 1,
    });

    const explanation = result.recommendations[0];
    if (!explanation) {
      return res.status(404).json({
        success: false,
        message: 'No active recommendation for this mentor. You may already have an active/pending mentorship.',
      });
    }

    res.json({
      success: true,
      recommendation: explanation,
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

module.exports = router;
