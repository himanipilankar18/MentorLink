const express = require('express');
const User = require('../models/User');
const { verifyToken, checkRole } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/security');
const sendEmail = require('../utils/sendEmail');

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
    const { name, year, department, skills, interests, cgpa, bio, projects } = req.body;
    const allowedUpdates = { name, year, department, skills, interests, cgpa, bio, projects };
    
    // Remove undefined fields
    Object.keys(allowedUpdates).forEach(key => 
      allowedUpdates[key] === undefined && delete allowedUpdates[key]
    );

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

module.exports = router;
