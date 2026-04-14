const express = require('express');
const crypto = require('crypto');
const ChatMessage = require('../models/ChatMessage');
const Group = require('../models/Group');
const User = require('../models/User');
const { createAndEmitNotification } = require('../utils/notifications');
const { verifyToken } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/security');

const router = express.Router();

// Helper: ensure group exists and user is a member
async function ensureGroupMember(groupId, userId) {
  const group = await Group.findById(groupId);
  if (!group || !group.isActive) {
    return { error: { status: 404, message: 'Group not found' } };
  }

  const isMember = group.members.some((m) => String(m.userId) === String(userId));
  if (!isMember) {
    return { error: { status: 403, message: 'You are not a member of this group' } };
  }

  return { group };
}

function generateJoinCode(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function generateUniqueJoinCode() {
  let attempts = 0;
  while (attempts < 12) {
    const code = generateJoinCode();
    // eslint-disable-next-line no-await-in-loop
    const exists = await Group.findOne({ joinCode: code }).select('_id').lean();
    if (!exists) return code;
    attempts += 1;
  }

  throw new Error('Unable to generate unique join code for direct chat');
}

function buildDirectGroupName(userAId, userBId) {
  const pairKey = [String(userAId), String(userBId)].sort().join(':');
  const hash = crypto.createHash('sha1').update(pairKey).digest('hex').slice(0, 18);
  return `direct-${hash}`;
}

// @route   POST /api/chat/direct/:userId/start
// @desc    Create or open a direct (non-mentorship) 1:1 chat between two users
// @access  Private
router.post('/direct/:userId/start', verifyToken, apiLimiter, async (req, res) => {
  try {
    const meId = String(req.user._id);
    const otherUserId = String(req.params.userId || '').trim();

    if (!otherUserId) {
      return res.status(400).json({
        success: false,
        message: 'Target user id is required',
      });
    }

    if (otherUserId === meId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot open direct chat with yourself',
      });
    }

    const [meUser, otherUser] = await Promise.all([
      User.findById(meId).select('name isActive').lean(),
      User.findById(otherUserId).select('name isActive').lean(),
    ]);

    if (!meUser || !meUser.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Current user is not active',
      });
    }

    if (!otherUser || !otherUser.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Target user not found',
      });
    }

    const groupName = buildDirectGroupName(meId, otherUserId);
    let group = await Group.findOne({ name: groupName, isActive: true });

    if (!group) {
      const joinCode = await generateUniqueJoinCode();
      const displayName = `Direct: ${meUser.name || 'User'} & ${otherUser.name || 'User'}`.slice(0, 100);

      group = await Group.create({
        name: groupName,
        displayName,
        description: 'Private direct chat',
        creatorId: req.user._id,
        joinCode,
        members: [
          { userId: req.user._id, role: 'owner' },
          { userId: otherUser._id, role: 'member' },
        ],
      });
    } else {
      const memberIds = new Set((group.members || []).map((entry) => String(entry.userId)));
      if (!memberIds.has(meId)) {
        group.members.push({ userId: req.user._id, role: 'member' });
      }
      if (!memberIds.has(otherUserId)) {
        group.members.push({ userId: otherUser._id, role: 'member' });
      }
      await group.save();
    }

    const populated = await Group.findById(group._id)
      .populate('members.userId', 'name profilePicture isOnline lastActiveAt')
      .lean();

    return res.json({
      success: true,
      message: 'Direct chat ready',
      group: populated || group,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to start direct chat',
      error: error.message,
    });
  }
});

// @route   GET /api/chat/group/:id/messages
// @desc    Get recent chat messages for a group (separate from communities)
// @access  Private (any authenticated user)
router.get('/group/:id/messages', verifyToken, apiLimiter, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);

    const { error } = await ensureGroupMember(req.params.id, req.user._id);
    if (error) {
      return res.status(error.status).json({ success: false, message: error.message });
    }

    const messages = await ChatMessage.find({ groupId: req.params.id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('senderId', 'name profilePicture')
      .lean();

    // Oldest first for UI
    messages.reverse();

    res.json({
      success: true,
      count: messages.length,
      messages,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch chat messages',
      error: error.message,
    });
  }
});

// @route   POST /api/chat/group/:id/messages
// @desc    Send a chat message in a group (separate from communities)
// @access  Private (any authenticated user)
router.post('/group/:id/messages', verifyToken, apiLimiter, async (req, res) => {
  try {
    const io = req.app.get('io');
    const { content } = req.body;

    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message content is required',
      });
    }

    const { error } = await ensureGroupMember(req.params.id, req.user._id);
    if (error) {
      return res.status(error.status).json({ success: false, message: error.message });
    }

    const group = await Group.findById(req.params.id).select('displayName name members');

    const message = await ChatMessage.create({
      groupId: req.params.id,
      senderId: req.user._id,
      content: content.trim(),
    });

    await message.populate('senderId', 'name profilePicture');

    if (group && Array.isArray(group.members)) {
      const senderId = String(req.user._id);
      const groupLabel = group.displayName || group.name || 'your group';
      const senderName = message.senderId?.name || 'Someone';

      const recipientIds = group.members
        .map((member) => String(member.userId))
        .filter((memberUserId) => memberUserId && memberUserId !== senderId);

      const uniqueRecipientIds = Array.from(new Set(recipientIds));

      await Promise.all(uniqueRecipientIds.map((memberUserId) => createAndEmitNotification({
        io,
        userId: memberUserId,
        type: 'NEW_MESSAGE',
        message: `${senderName} sent a message in ${groupLabel}.`,
        relatedId: req.params.id,
      }).catch((notifyError) => {
        console.error('Failed to create message notification:', notifyError.message);
      })));
    }

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      chat: message,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to send message',
      error: error.message,
    });
  }
});

module.exports = router;
