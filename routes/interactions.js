const express = require('express');
const Interaction = require('../models/Interaction');
const Mentorship = require('../models/Mentorship');
const { verifyToken } = require('../middleware/auth');
const { validateInteraction, handleValidationErrors } = require('../middleware/validation');
const { apiLimiter } = require('../middleware/security');
const { awardForConfirmedInteraction } = require('../utils/contributionService');
const { canVouchForMentoring, NOT_COUNTED_NOTE } = require('../utils/evidencePolicy');
const { createAndEmitNotification } = require('../utils/notifications');

const router = express.Router();

// Feedback that only the mentee may give. Mentors can never set these on their own sessions,
// otherwise the "verified evidence" the recommender relies on could be self-reported.
function parseMenteeFeedback(body = {}) {
  const feedback = {};
  const errors = [];
  if (body.satisfactionRating !== undefined && body.satisfactionRating !== null && body.satisfactionRating !== '') {
    const rating = Number(body.satisfactionRating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) errors.push('Rating must be a whole number from 1 to 5');
    else feedback.satisfactionRating = rating;
  }
  if (body.outcomeStatus !== undefined) {
    if (!['resolved', 'unresolved'].includes(body.outcomeStatus)) errors.push('Outcome must be resolved or unresolved');
    else feedback.outcomeStatus = body.outcomeStatus;
  }
  if (body.menteeWouldRecommend !== undefined && body.menteeWouldRecommend !== null) {
    feedback.menteeWouldRecommend = body.menteeWouldRecommend === true || body.menteeWouldRecommend === 'true';
  }
  if (body.followUpCompleted !== undefined) {
    feedback.followUpCompleted = body.followUpCompleted === true || body.followUpCompleted === 'true';
  }
  return { feedback, errors };
}

function notifySafely(req, payload) {
  return createAndEmitNotification({ io: req.app.get('io'), ...payload })
    .catch((error) => console.warn('[interactions] notification failed:', error.message));
}

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
      const {
        mentorId: providedMentorId,
        mentorshipId,
        topic,
        subjectTag,
        interactionType,
        duration,
        satisfactionRating,
        outcomeStatus,
        menteeWouldRecommend,
        followUpCompleted,
        notes,
      } = req.body;
      const actorId = req.user._id;

      // Verify mentorship exists and is accepted
      const mentorship = await Mentorship.findById(mentorshipId);
      if (!mentorship) {
        return res.status(404).json({
          success: false,
          message: 'Mentorship not found'
        });
      }

      const mentorshipStatus = String(mentorship.status || '').toLowerCase();
      if (mentorshipStatus !== 'accepted') {
        return res.status(400).json({
          success: false,
          message: 'Can only log interactions for accepted mentorships'
        });
      }

      // Verify user is part of this mentorship
      const mentorshipMentorId = mentorship.mentorId || mentorship.recipient;
      const mentorshipMenteeId = mentorship.menteeId || mentorship.requester;

      if (!mentorshipMentorId || !mentorshipMenteeId) {
        return res.status(400).json({
          success: false,
          message: 'Mentorship participants are not defined',
        });
      }

      const isMentor = String(mentorshipMentorId) === String(actorId);
      const isMentee = String(mentorshipMenteeId) === String(actorId);

      if (isMentor && String(req.user.userType || '').toUpperCase() === 'EXTERNAL') {
        return res.status(403).json({
          success: false,
          message: 'External users can seek mentorship but cannot log mentoring activity as a mentor',
        });
      }

      if (!isMentor && !isMentee) {
        return res.status(403).json({
          success: false,
          message: 'You are not authorized to log interactions for this mentorship'
        });
      }

      // Backward compatibility: if mentorId is supplied by client, validate it.
      if (providedMentorId && String(mentorshipMentorId) !== String(providedMentorId)) {
        return res.status(400).json({
          success: false,
          message: 'Mentor ID does not match the mentorship'
        });
      }

      // Only the mentee's own feedback is accepted. A session the mentee logs is
      // confirmed straight away (they are the verifier); a mentor-logged session waits for them.
      const { feedback, errors } = isMentee
        ? parseMenteeFeedback({ satisfactionRating, outcomeStatus, menteeWouldRecommend, followUpCompleted })
        : { feedback: {}, errors: [] };
      if (errors.length) {
        return res.status(400).json({ success: false, message: errors.join('; ') });
      }

      const interaction = await Interaction.create({
        mentorId: mentorshipMentorId,
        menteeId: mentorshipMenteeId,
        mentorshipId,
        topic,
        subjectTag,
        interactionType,
        duration: duration || null,
        satisfactionRating: feedback.satisfactionRating ?? null,
        outcomeStatus: feedback.outcomeStatus || 'unresolved',
        menteeWouldRecommend: feedback.menteeWouldRecommend ?? null,
        followUpCompleted: feedback.followUpCompleted === true,
        notes: notes || '',
        loggedBy: isMentee ? 'mentee' : 'mentor',
        evidenceEligible: isMentee ? canVouchForMentoring(req.user) : null,
        confirmationStatus: isMentee ? 'confirmed' : 'pending',
        confirmedAt: isMentee ? new Date() : null,
        timestamp: new Date()
      });

      let contribution = null;
      if (isMentee) {
        contribution = await awardForConfirmedInteraction(interaction._id);
        notifySafely(req, {
          userId: mentorshipMentorId,
          type: 'SESSION_CONFIRMED',
          message: `${req.user.name || 'Your mentee'} logged and confirmed a session: "${topic}"`,
          relatedId: interaction._id,
        });
      } else {
        notifySafely(req, {
          userId: mentorshipMenteeId,
          type: 'SESSION_TO_CONFIRM',
          message: `${req.user.name || 'Your mentor'} logged a session with you: "${topic}". Please confirm and rate it.`,
          relatedId: interaction._id,
        });
      }

      await interaction.populate('mentorId', 'name email department');
      await interaction.populate('menteeId', 'name email department');
      await interaction.populate('mentorshipId');

      res.status(201).json({
        success: true,
        message: isMentee
          ? (interaction.evidenceEligible ? 'Session logged and confirmed' : `Session logged and confirmed. ${NOT_COUNTED_NOTE}`)
          : 'Session logged. Your mentee has been asked to confirm and rate it.',
        interaction,
        contribution,
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
    const { mentorshipId, subjectTag, interactionType, startDate, endDate, confirmationStatus, as, limit = 50 } = req.query;
    const userId = req.user._id;

    // Build query based on user role; `as=mentee` or `as=mentor` narrows to one side.
    const query = as === 'mentee'
      ? { menteeId: userId }
      : as === 'mentor'
        ? { mentorId: userId }
        : { $or: [{ mentorId: userId }, { menteeId: userId }] };

    if (['pending', 'confirmed', 'disputed'].includes(confirmationStatus)) {
      query.confirmationStatus = confirmationStatus;
    }

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

// @route   POST /api/interactions/:id/confirm
// @desc    Confirm a logged session and award auditable mentor contribution points
// @access  Private (mentee only)
router.post('/:id/confirm', verifyToken, apiLimiter, async (req, res) => {
  try {
    const interaction = await Interaction.findById(req.params.id);
    if (!interaction) return res.status(404).json({ success: false, message: 'Interaction not found' });
    if (String(interaction.menteeId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Only the mentee can confirm an interaction' });
    }
    if (interaction.confirmationStatus === 'confirmed') {
      return res.json({ success: true, message: 'Interaction was already confirmed', interaction });
    }
    if (interaction.confirmationStatus === 'disputed') {
      return res.status(400).json({ success: false, message: 'This session was reported as not having happened' });
    }

    // The mentee's feedback is saved together with the confirmation and then locked.
    const { feedback, errors } = parseMenteeFeedback(req.body);
    if (errors.length) return res.status(400).json({ success: false, message: errors.join('; ') });
    Object.assign(interaction, feedback);
    interaction.confirmationStatus = 'confirmed';
    interaction.confirmedAt = new Date();
    interaction.evidenceEligible = canVouchForMentoring(req.user);
    await interaction.save();
    const contribution = await awardForConfirmedInteraction(interaction._id);

    notifySafely(req, {
      userId: interaction.mentorId,
      type: 'SESSION_CONFIRMED',
      message: `${req.user.name || 'Your mentee'} confirmed your session "${interaction.topic}"`,
      relatedId: interaction._id,
    });

    res.json({
      success: true,
      message: interaction.evidenceEligible
        ? 'Interaction confirmed and contribution points updated'
        : `Interaction confirmed. ${NOT_COUNTED_NOTE}`,
      interaction,
      contribution,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to confirm interaction', error: error.message });
  }
});

// @route   POST /api/interactions/:id/dispute
// @desc    Mentee reports that a mentor-logged session did not happen
// @access  Private (mentee only)
router.post('/:id/dispute', verifyToken, apiLimiter, async (req, res) => {
  try {
    const interaction = await Interaction.findById(req.params.id);
    if (!interaction) return res.status(404).json({ success: false, message: 'Interaction not found' });
    if (String(interaction.menteeId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Only the mentee can dispute a session' });
    }
    if (interaction.confirmationStatus !== 'pending') {
      return res.status(400).json({ success: false, message: `This session is already ${interaction.confirmationStatus}` });
    }

    interaction.confirmationStatus = 'disputed';
    interaction.disputedAt = new Date();
    await interaction.save();

    notifySafely(req, {
      userId: interaction.mentorId,
      type: 'SESSION_DISPUTED',
      message: `${req.user.name || 'Your mentee'} said the session "${interaction.topic}" did not happen`,
      relatedId: interaction._id,
    });

    res.json({ success: true, message: 'Session marked as not having happened', interaction });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to dispute interaction', error: error.message });
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
    const { duration, satisfactionRating, outcomeStatus, menteeWouldRecommend, followUpCompleted, notes } = req.body;
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

    const isMentee = interaction.menteeId.toString() === userId;
    const status = interaction.confirmationStatus;
    const feedbackTouched = [satisfactionRating, outcomeStatus, menteeWouldRecommend]
      .some((value) => value !== undefined);

    if (status === 'disputed') {
      return res.status(400).json({ success: false, message: 'A disputed session cannot be edited' });
    }

    let reaward = false;
    if (status === 'pending') {
      // While pending, the logger can fix details; feedback is only given when the mentee confirms.
      if (feedbackTouched || followUpCompleted !== undefined) {
        return res.status(400).json({ success: false, message: 'Feedback is given by the mentee when confirming the session' });
      }
      if (duration !== undefined) interaction.duration = duration;
      if (notes !== undefined) interaction.notes = notes;
    } else {
      // Confirmed sessions are locked evidence. The one allowed change: the mentee can
      // record later that the follow-up happened.
      if (feedbackTouched || duration !== undefined) {
        return res.status(400).json({ success: false, message: 'Confirmed sessions are locked and cannot be changed' });
      }
      if (followUpCompleted !== undefined) {
        if (!isMentee) return res.status(403).json({ success: false, message: 'Only the mentee can mark the follow-up as done' });
        if (followUpCompleted !== true) return res.status(400).json({ success: false, message: 'A completed follow-up cannot be undone' });
        if (!interaction.followUpCompleted) {
          interaction.followUpCompleted = true;
          reaward = true;
        }
      }
      if (notes !== undefined) interaction.notes = notes;
    }

    await interaction.save();
    // Contribution events are idempotent, so this only adds the follow-up points.
    if (reaward) await awardForConfirmedInteraction(interaction._id);
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
