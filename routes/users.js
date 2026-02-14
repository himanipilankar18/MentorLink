const express = require('express');
const User = require('../models/User');
const { verifyToken, checkRole } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/security');

const router = express.Router();

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

    res.json({
      success: true,
      user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user profile',
      error: error.message
    });
  }
});

// @route   PUT /api/users/profile
// @desc    Update own profile
// @access  Private
router.put('/profile', verifyToken, apiLimiter, async (req, res) => {
  try {
    const { name, year, department, skills, interests, cgpa } = req.body;
    const allowedUpdates = { name, year, department, skills, interests, cgpa };
    
    // Remove undefined fields
    Object.keys(allowedUpdates).forEach(key => 
      allowedUpdates[key] === undefined && delete allowedUpdates[key]
    );

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: allowedUpdates },
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
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
    
    const query = {
      role: { $in: ['senior', 'faculty'] },
      isActive: true
    };

    if (department) {
      query.department = department;
    }

    const mentors = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: mentors.length,
      mentors
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch mentors',
      error: error.message
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
      isActive: true
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

module.exports = router;
