const express = require('express');
const Mentorship = require('../models/Mentorship');
const User = require('../models/User');
const { verifyToken, isMentee, isMentor } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/security');

const router = express.Router();

// @route   POST /api/mentorship/request
// @desc    Request mentorship (junior only)
// @access  Private (Juniors only)
router.post('/request', verifyToken, isMentee, apiLimiter, async (req, res) => {
  try {
    const { mentorId } = req.body;
    const menteeId = req.user._id;

    // Validate mentor exists and is a mentor
    const mentor = await User.findById(mentorId);
    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: 'Mentor not found'
      });
    }

    if (!['senior', 'faculty'].includes(mentor.role)) {
      return res.status(400).json({
        success: false,
        message: 'Selected user is not a mentor'
      });
    }

    // Prevent self-request
    if (mentorId.toString() === menteeId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot request mentorship from yourself'
      });
    }

    // Check for existing request
    const existingRequest = await Mentorship.findOne({
      mentorId,
      menteeId
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: `Mentorship request already exists with status: ${existingRequest.status}`
      });
    }

    // Create mentorship request
    const mentorship = await Mentorship.create({
      mentorId,
      menteeId,
      status: 'Pending'
    });

    await mentorship.populate('mentorId', 'name email department year role');
    await mentorship.populate('menteeId', 'name email department year');

    res.status(201).json({
      success: true,
      message: 'Mentorship request sent successfully',
      mentorship
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Mentorship request already exists'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to create mentorship request',
      error: error.message
    });
  }
});

// @route   PUT /api/mentorship/:id/accept
// @desc    Accept mentorship request (mentor only)
// @access  Private (Mentors only)
router.put('/:id/accept', verifyToken, isMentor, apiLimiter, async (req, res) => {
  try {
    const mentorship = await Mentorship.findById(req.params.id);

    if (!mentorship) {
      return res.status(404).json({
        success: false,
        message: 'Mentorship request not found'
      });
    }

    // Verify mentor owns this request
    if (mentorship.mentorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only accept requests sent to you'
      });
    }

    if (mentorship.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot accept request with status: ${mentorship.status}`
      });
    }

    await mentorship.accept();
    await mentorship.populate('mentorId', 'name email department');
    await mentorship.populate('menteeId', 'name email department');

    res.json({
      success: true,
      message: 'Mentorship request accepted',
      mentorship
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to accept mentorship request',
      error: error.message
    });
  }
});

// @route   PUT /api/mentorship/:id/reject
// @desc    Reject mentorship request (mentor only)
// @access  Private (Mentors only)
router.put('/:id/reject', verifyToken, isMentor, apiLimiter, async (req, res) => {
  try {
    const mentorship = await Mentorship.findById(req.params.id);

    if (!mentorship) {
      return res.status(404).json({
        success: false,
        message: 'Mentorship request not found'
      });
    }

    // Verify mentor owns this request
    if (mentorship.mentorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only reject requests sent to you'
      });
    }

    if (mentorship.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot reject request with status: ${mentorship.status}`
      });
    }

    await mentorship.reject();
    await mentorship.populate('mentorId', 'name email department');
    await mentorship.populate('menteeId', 'name email department');

    res.json({
      success: true,
      message: 'Mentorship request rejected',
      mentorship
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to reject mentorship request',
      error: error.message
    });
  }
});

// @route   GET /api/mentorship/my-requests
// @desc    Get user's mentorship requests
// @access  Private
router.get('/my-requests', verifyToken, apiLimiter, async (req, res) => {
  try {
    const userId = req.user._id;
    const { status } = req.query;

    const query = {
      $or: [
        { mentorId: userId },
        { menteeId: userId }
      ]
    };

    if (status) {
      query.status = status;
    }

    const mentorships = await Mentorship.find(query)
      .populate('mentorId', 'name email department year role skills')
      .populate('menteeId', 'name email department year skills')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: mentorships.length,
      mentorships
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch mentorship requests',
      error: error.message
    });
  }
});

// @route   GET /api/mentorship/active
// @desc    Get active mentorships
// @access  Private
router.get('/active', verifyToken, apiLimiter, async (req, res) => {
  try {
    const userId = req.user._id;

    const mentorships = await Mentorship.find({
      $or: [
        { mentorId: userId },
        { menteeId: userId }
      ],
      status: 'Accepted'
    })
      .populate('mentorId', 'name email department year role skills')
      .populate('menteeId', 'name email department year skills')
      .sort({ acceptedAt: -1 });

    res.json({
      success: true,
      count: mentorships.length,
      mentorships
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active mentorships',
      error: error.message
    });
  }
});

// @route   PUT /api/mentorship/:id/terminate
// @desc    Terminate active mentorship
// @access  Private (Both mentor and mentee)
router.put('/:id/terminate', verifyToken, apiLimiter, async (req, res) => {
  try {
    const mentorship = await Mentorship.findById(req.params.id);

    if (!mentorship) {
      return res.status(404).json({
        success: false,
        message: 'Mentorship not found'
      });
    }

    // Verify user is part of this mentorship
    const userId = req.user._id.toString();
    if (mentorship.mentorId.toString() !== userId && mentorship.menteeId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You are not part of this mentorship'
      });
    }

    if (mentorship.status !== 'Accepted') {
      return res.status(400).json({
        success: false,
        message: 'Can only terminate accepted mentorships'
      });
    }

    await mentorship.terminate();
    await mentorship.populate('mentorId', 'name email department');
    await mentorship.populate('menteeId', 'name email department');

    res.json({
      success: true,
      message: 'Mentorship terminated',
      mentorship
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to terminate mentorship',
      error: error.message
    });
  }
});

module.exports = router;
