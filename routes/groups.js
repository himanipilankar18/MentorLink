const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const Group = require('../models/Group');
const { verifyToken } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/security');

const router = express.Router();

// Helper utilities for roles/permissions
function isPrivateMentorshipGroup(group) {
  const name = typeof group?.name === 'string' ? group.name : '';
  return name.startsWith('mentorship-') || name.startsWith('direct-');
}

function getMemberRole(group, userId) {
  if (!group || !Array.isArray(group.members)) return null;
  const member = group.members.find((m) => String(m.userId) === String(userId));
  return member ? member.role : null;
}

function isOwner(group, userId) {
  if (!group) return false;
  if (String(group.creatorId) === String(userId)) return true;
  return getMemberRole(group, userId) === 'owner';
}

function isAdminOrOwner(group, userId) {
  const role = getMemberRole(group, userId);
  if (role === 'owner' || role === 'admin') return true;
  return String(group.creatorId) === String(userId);
}

// Multer setup for group avatar uploads
const groupImageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join('public', 'uploads', 'groups');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'group-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const groupImageUpload = multer({
  storage: groupImageStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
  },
});

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
    const groups = await Group.find({
      isActive: true,
      $and: [
        { name: { $not: /^(mentorship-|direct-)/ } },
        { $or: [{ groupType: { $ne: 'mentorship' } }, { groupType: { $exists: false } }] },
      ],
    })
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
// @desc    Get groups current user is a member of or has created (with basic member info)
// @access  Private
router.get('/my', verifyToken, apiLimiter, async (req, res) => {
  try {
    const groups = await Group.find({
      isActive: true,
      hiddenFor: { $ne: req.user._id },
      $or: [
        { 'members.userId': req.user._id },
        { creatorId: req.user._id },
      ],
    })
      .sort({ updatedAt: -1 })
      .populate('members.userId', 'name profilePicture isOnline lastActiveAt')
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

    if (isPrivateMentorshipGroup(group)) {
      return res.status(403).json({
        success: false,
        message: 'Private mentorship chats cannot be joined by code',
      });
    }

    const isMember = group.members.some((m) => String(m.userId) === String(req.user._id));
    if (isMember) {
      group.hiddenFor = (group.hiddenFor || []).filter((userId) => String(userId) !== String(req.user._id));
      await group.save();

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

    group.hiddenFor = (group.hiddenFor || []).filter((userId) => String(userId) !== String(req.user._id));
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

// @route   GET /api/groups/:id
// @desc    Get a single group with member info (only if requester is a member or creator)
// @access  Private
router.get('/:id', verifyToken, apiLimiter, async (req, res) => {
  try {
    const { id } = req.params;

    const group = await Group.findOne({ _id: id, isActive: true })
      .populate('members.userId', 'name')
      .lean();

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found',
      });
    }

    const isMemberOrCreator = String(group.creatorId) === String(req.user._id)
      || (group.members || []).some((m) => String(m.userId) === String(req.user._id));

    if (!isMemberOrCreator) {
      return res.status(403).json({
        success: false,
        message: 'You are not allowed to view this group',
      });
    }

    return res.json({
      success: true,
      group,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch group',
      error: error.message,
    });
  }
});

// @route   PATCH /api/groups/:id
// @desc    Update basic group details (admin only)
// @access  Private
router.patch('/:id', verifyToken, apiLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      displayName,
      description,
      avatarUrl,
      pinnedMessage,
    } = req.body;

    const group = await Group.findById(id);

    if (!group || !group.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Group not found',
      });
    }

    if (!isAdminOrOwner(group, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Only the group admin can update group details',
      });
    }

    if (typeof displayName === 'string' && displayName.trim()) {
      group.displayName = displayName.trim();
    }

    if (typeof description === 'string') {
      group.description = description.trim();
    }

    if (typeof avatarUrl === 'string') {
      group.avatarUrl = avatarUrl.trim();
    }

    if (typeof pinnedMessage === 'string') {
      group.pinnedMessage = pinnedMessage.trim();
    }

    await group.save();

    const populated = await group.populate('members.userId', 'name');

    return res.json({
      success: true,
      message: 'Group updated successfully',
      group: populated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update group',
      error: error.message,
    });
  }
});

// @route   POST /api/groups/:id/avatar
// @desc    Upload or replace group avatar image (admin only) and optionally update description
// @access  Private
router.post('/:id/avatar', verifyToken, apiLimiter, groupImageUpload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { description, pinnedMessage } = req.body;

    const group = await Group.findById(id);

    if (!group || !group.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Group not found',
      });
    }

    if (!isAdminOrOwner(group, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Only the group admin can update the avatar',
      });
    }

    if (!req.file && typeof description !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'No changes provided',
      });
    }

    if (typeof description === 'string') {
      group.description = description.trim();
    }

    if (req.file) {
      const imageUrl = `/uploads/groups/${req.file.filename}`;
      group.avatarUrl = imageUrl;
    }

    if (typeof pinnedMessage === 'string') {
      group.pinnedMessage = pinnedMessage.trim();
    }

    await group.save();

    const populated = await group.populate('members.userId', 'name');

    return res.json({
      success: true,
      message: 'Group avatar updated successfully',
      group: populated,
      imageUrl: populated.avatarUrl,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update group avatar',
      error: error.message,
    });
  }
});

// @route   PATCH /api/groups/:id/members/:memberId/role
// @desc    Update a member's role (owner only)
// @access  Private
router.patch('/:id/members/:memberId/role', verifyToken, apiLimiter, async (req, res) => {
  try {
    const { id, memberId } = req.params;
    const { role } = req.body;

    const allowedRoles = ['member', 'admin', 'moderator'];
    if (!role || !allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Allowed: member, admin, moderator',
      });
    }

    const group = await Group.findById(id);

    if (!group || !group.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Group not found',
      });
    }

    if (!isOwner(group, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Only the group owner can change member roles',
      });
    }

    const member = (group.members || []).find((m) => String(m.userId) === String(memberId));
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found in this group',
      });
    }

    if (member.role === 'owner') {
      return res.status(400).json({
        success: false,
        message: 'Owner role cannot be changed here',
      });
    }

    member.role = role;
    await group.save();

    const populated = await group.populate('members.userId', 'name');

    return res.json({
      success: true,
      message: 'Member role updated',
      group: populated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update member role',
      error: error.message,
    });
  }
});

// @route   DELETE /api/groups/:id/members/:memberId
// @desc    Remove a member from group (admin/owner, or self-leave)
// @access  Private
router.delete('/:id/members/:memberId', verifyToken, apiLimiter, async (req, res) => {
  try {
    const { id, memberId } = req.params;

    const group = await Group.findById(id);

    if (!group || !group.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Group not found',
      });
    }

    const actingId = req.user._id;
    const actingRole = getMemberRole(group, actingId);
    const targetIndex = (group.members || []).findIndex((m) => String(m.userId) === String(memberId));

    if (targetIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Member not found in this group',
      });
    }

    const target = group.members[targetIndex];

    const isSelf = String(memberId) === String(actingId);

    if (!isSelf) {
      if (!isAdminOrOwner(group, actingId)) {
        return res.status(403).json({
          success: false,
          message: 'You are not allowed to remove members',
        });
      }

      if (target.role === 'admin' && !isOwner(group, actingId)) {
        return res.status(403).json({
          success: false,
          message: 'Only the owner can remove an admin',
        });
      }

      if (target.role === 'owner') {
        return res.status(400).json({
          success: false,
          message: 'Owner cannot be removed here',
        });
      }
    }

    group.members.splice(targetIndex, 1);
    await group.save();

    const populated = await group.populate('members.userId', 'name');

    return res.json({
      success: true,
      message: isSelf ? 'You left the group' : 'Member removed from group',
      group: populated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update group membership',
      error: error.message,
    });
  }
});

module.exports = router;
