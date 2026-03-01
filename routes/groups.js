const express = require('express');
const Group = require('../models/Group');
const { verifyToken } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/security');

const router = express.Router();

// Helper to generate a short join code
function generateJoinCode(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// @route   POST /api/groups
// @desc    Create a new chat group (separate from communities)
// @access  Private
router.post('/', verifyToken, apiLimiter, async (req, res) => {
  try {
    const { name, displayName, description } = req.body;

    if (!name || !displayName) {
      return res.status(400).json({
        success: false,
        message: 'Name and display name are required',
      });
    }

    const normalizedName = name.toLowerCase().replace(/\s+/g, '-');

    const existing = await Group.findOne({ name: normalizedName });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'A group with this name already exists',
      });
    }

    // Generate a unique join code
    let joinCode;
    let attempts = 0;
    const maxAttempts = 5;
    do {
      joinCode = generateJoinCode();
      // eslint-disable-next-line no-await-in-loop
      const existingCode = await Group.findOne({ joinCode });
      if (!existingCode) break;
      attempts += 1;
    } while (attempts < maxAttempts);

    if (!joinCode) {
      return res.status(500).json({
        success: false,
        message: 'Failed to generate group join code. Please try again.',
      });
    }

    const group = await Group.create({
      name: normalizedName,
      displayName,
      description: description || '',
      creatorId: req.user._id,
      joinCode,
      members: [{
        userId: req.user._id,
        role: 'owner',
      }],
    });

    res.status(201).json({
      success: true,
      message: 'Group created successfully',
      group,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create group',
      error: error.message,
    });
  }
});

// @route   GET /api/groups
// @desc    Get all active groups (for discovery / selection)
// @access  Private
router.get('/', verifyToken, apiLimiter, async (req, res) => {
  try {
    const groups = await Group.find({ isActive: true })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      count: groups.length,
      groups,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch groups',
      error: error.message,
    });
  }
});

// @route   GET /api/groups/my
// @desc    Get groups current user is a member of or has created
// @access  Private
router.get('/my', verifyToken, apiLimiter, async (req, res) => {
  try {
    const groups = await Group.find({
      isActive: true,
      $or: [
        { 'members.userId': req.user._id },
        { creatorId: req.user._id },
      ],
    })
      .sort({ updatedAt: -1 })
      .lean();

    res.json({
      success: true,
      count: groups.length,
      groups,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch your groups',
      error: error.message,
    });
  }
});

// @route   POST /api/groups/join
// @desc    Join a group using join code
// @access  Private
router.post('/join', verifyToken, apiLimiter, async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Join code is required',
      });
    }

    const normalizedCode = String(code).trim().toUpperCase();

    const group = await Group.findOne({ joinCode: normalizedCode, isActive: true });
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or expired join code',
      });
    }

    const isMember = group.members.some((m) => String(m.userId) === String(req.user._id));
    if (isMember) {
      return res.json({
        success: true,
        message: 'You are already a member of this group',
        group,
      });
    }

    group.members.push({
      userId: req.user._id,
      role: 'member',
    });

    await group.save();

    res.json({
      success: true,
      message: 'Joined group successfully',
      group,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to join group',
      error: error.message,
    });
  }
});

module.exports = router;
