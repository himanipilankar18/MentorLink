const express = require('express');
const Interaction = require('../models/Interaction');
const Mentorship = require('../models/Mentorship');
const { verifyToken } = require('../middleware/auth');
const { validateInteraction, handleValidationErrors } = require('../middleware/validation');
const { apiLimiter } = require('../middleware/security');

const router = express.Router();

// @route   POST /api/interactions
// @desc    Log a structured interaction (MOST CRITICAL FOR ANALYTICS)
// @access  Private
router.post('/',
  verifyToken,
  apiLimiter,
  validateInteraction,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { mentorId, mentorshipId, topic, subjectTag, interactionType, duration, satisfactionRating, notes } = req.body;
      const menteeId = req.user._id;

      // Verify mentorship exists and is accepted
      const mentorship = await Mentorship.findById(mentorshipId);
      if (!mentorship) {
        return res.status(404).json({
          success: false,
          message: 'Mentorship not found'
        });
      }

      if (mentorship.status !== 'Accepted') {
        return res.status(400).json({
          success: false,
          message: 'Can only log interactions for accepted mentorships'
        });
      }

      // Verify user is part of this mentorship
      const userId = req.user._id.toString();
      if (mentorship.mentorId.toString() !== mentorId && mentorship.menteeId.toString() !== userId) {
        return res.status(403).json({
          success: false,
          message: 'You are not authorized to log interactions for this mentorship'
        });
      }

      // Verify mentorId matches mentorship
      if (mentorship.mentorId.toString() !== mentorId) {
        return res.status(400).json({
          success: false,
          message: 'Mentor ID does not match the mentorship'
        });
      }

      // Create interaction record
      const interaction = await Interaction.create({
        mentorId,
        menteeId,
        mentorshipId,
        topic,
        subjectTag,
        interactionType,
        duration: duration || null,
        satisfactionRating: satisfactionRating || null,
        notes: notes || '',
        timestamp: new Date()
      });

      await interaction.populate('mentorId', 'name email department');
      await interaction.populate('menteeId', 'name email department');
      await interaction.populate('mentorshipId');

      res.status(201).json({
        success: true,
        message: 'Interaction logged successfully',
        interaction
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to log interaction',
        error: error.message
      });
    }
  }
);

// @route   GET /api/interactions
// @desc    Get interactions (filtered by user role and mentorship)
// @access  Private
router.get('/', verifyToken, apiLimiter, async (req, res) => {
  try {
    const { mentorshipId, subjectTag, interactionType, startDate, endDate, limit = 50 } = req.query;
    const userId = req.user._id;

    // Build query based on user role
    const query = {
      $or: [
        { mentorId: userId },
        { menteeId: userId }
      ]
    };

    if (mentorshipId) {
      query.mentorshipId = mentorshipId;
    }

    if (subjectTag) {
      query.subjectTag = subjectTag;
    }

    if (interactionType) {
      query.interactionType = interactionType;
    }

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const interactions = await Interaction.find(query)
      .populate('mentorId', 'name email department')
      .populate('menteeId', 'name email department')
      .populate('mentorshipId')
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      count: interactions.length,
      interactions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch interactions',
      error: error.message
    });
  }
});

// @route   GET /api/interactions/stats
// @desc    Get interaction statistics for analytics
// @access  Private
router.get('/stats', verifyToken, apiLimiter, async (req, res) => {
  try {
    const userId = req.user._id;
    const { mentorshipId, startDate, endDate } = req.query;

    const matchQuery = {
      $or: [
        { mentorId: userId },
        { menteeId: userId }
      ]
    };

    if (mentorshipId) {
      matchQuery.mentorshipId = mentorshipId;
    }

    if (startDate || endDate) {
      matchQuery.timestamp = {};
      if (startDate) matchQuery.timestamp.$gte = new Date(startDate);
      if (endDate) matchQuery.timestamp.$lte = new Date(endDate);
    }

    // Aggregate statistics
    const stats = await Interaction.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalInteractions: { $sum: 1 },
          totalDuration: { $sum: { $ifNull: ['$duration', 0] } },
          avgSatisfaction: { $avg: '$satisfactionRating' },
          bySubjectTag: {
            $push: '$subjectTag'
          },
          byInteractionType: {
            $push: '$interactionType'
          }
        }
      }
    ]);

    // Subject tag distribution
    const subjectTagStats = await Interaction.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$subjectTag',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Interaction type distribution
    const interactionTypeStats = await Interaction.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$interactionType',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      stats: stats[0] || {
        totalInteractions: 0,
        totalDuration: 0,
        avgSatisfaction: null
      },
      subjectTagDistribution: subjectTagStats,
      interactionTypeDistribution: interactionTypeStats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch interaction statistics',
      error: error.message
    });
  }
});

// @route   GET /api/interactions/:id
// @desc    Get single interaction by ID
// @access  Private
router.get('/:id', verifyToken, apiLimiter, async (req, res) => {
  try {
    const interaction = await Interaction.findById(req.params.id)
      .populate('mentorId', 'name email department')
      .populate('menteeId', 'name email department')
      .populate('mentorshipId');

    if (!interaction) {
      return res.status(404).json({
        success: false,
        message: 'Interaction not found'
      });
    }

    // Verify user has access
    const userId = req.user._id.toString();
    if (interaction.mentorId._id.toString() !== userId && interaction.menteeId._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      interaction
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch interaction',
      error: error.message
    });
  }
});

// @route   PUT /api/interactions/:id
// @desc    Update interaction (limited fields)
// @access  Private
router.put('/:id', verifyToken, apiLimiter, async (req, res) => {
  try {
    const { duration, satisfactionRating, notes } = req.body;
    const interaction = await Interaction.findById(req.params.id);

    if (!interaction) {
      return res.status(404).json({
        success: false,
        message: 'Interaction not found'
      });
    }

    // Verify user has access
    const userId = req.user._id.toString();
    if (interaction.mentorId.toString() !== userId && interaction.menteeId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Update allowed fields only
    if (duration !== undefined) interaction.duration = duration;
    if (satisfactionRating !== undefined) interaction.satisfactionRating = satisfactionRating;
    if (notes !== undefined) interaction.notes = notes;

    await interaction.save();
    await interaction.populate('mentorId', 'name email department');
    await interaction.populate('menteeId', 'name email department');

    res.json({
      success: true,
      message: 'Interaction updated successfully',
      interaction
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update interaction',
      error: error.message
    });
  }
});

module.exports = router;
