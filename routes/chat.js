const express = require('express');
const ChatMessage = require('../models/ChatMessage');
const Group = require('../models/Group');
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
