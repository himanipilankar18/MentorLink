const express = require('express');
const User = require('../models/User');
const { verifyToken, checkRole } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/security');
const sendEmail = require('../utils/sendEmail');

const router = express.Router();

const MAX_SKILLS = 10;

function normalizeSkills(input) {
  if (!Array.isArray(input)) return [];

  const normalized = input
    .map((skill) => String(skill || '').trim().toLowerCase())
    .filter(Boolean);

  return Array.from(new Set(normalized));
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

    res.json({
      success: true,
      user: {
        ...payload,
        mentorshipIntent: payload.mentorshipIntent || 'seeking',
        availability: payload.availability || 'flexible',
        profileStrength: calculateProfileStrength(payload),
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

    return res.json({
      success: true,
      message: 'Now following user',
      isFollowing: true,
      followerCount: updatedTarget.followers.length,
      followingCount: updatedMe.following.length,
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

    const currentUser = await User.findById(req.user._id).select('following');
    const regex = new RegExp(query, 'i');

    const users = await User.find({
      isVerified: true,
      name: regex,
    })
      .select('name email department year role profilePicture bio followers following isOnline lastActiveAt')
      .limit(parseInt(limit));

    const followingSet = new Set((currentUser.following || []).map((id) => String(id)));

    const enriched = users.map((u) => ({
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
      isFollowing: followingSet.has(String(u._id)),
      isOnline: !!u.isOnline,
      lastActiveAt: u.lastActiveAt || null,
    }));

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

    const currentUser = await User.findById(req.user._id).select('interests following');
    const myInterests = currentUser?.interests || [];

    // If user has no interests, we can't match on them – return empty list
    if (!myInterests.length) {
      return res.json({ success: true, count: 0, users: [] });
    }

    // Only suggest users that share at least one interest
    const suggestions = await User.find({
      _id: { $ne: req.user._id },
      isVerified: true,
      interests: { $in: myInterests },
    })
      .select('name email department year role profilePicture bio isOnline lastActiveAt')
      .limit(parseInt(limit));

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
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch suggestions',
      error: error.message
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
