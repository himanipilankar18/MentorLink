const express = require('express');
const crypto = require('crypto');
const Mentorship = require('../models/Mentorship');
const User = require('../models/User');
const Group = require('../models/Group');
const sendEmail = require('../utils/sendEmail');
const { verifyToken } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/security');

const router = express.Router();
const MIN_REQUEST_REASON_LENGTH = 20;
const MIN_REJECTION_REASON_LENGTH = 5;

function toStatus(status) {
  if (!status || typeof status !== 'string') return '';
  return status.toLowerCase();
}

function normalizeStatus(status) {
  const normalized = toStatus(status);
  if (!normalized) return '';

  switch (normalized) {
    case 'pending':
      return 'pending';
    case 'accepted':
      return 'accepted';
    case 'rejected':
      return 'rejected';
    case 'terminated':
      return 'terminated';
    default:
      return '';
  }
}

function buildStatusQuery(status) {
  const normalized = normalizeStatus(status);
  if (!normalized) return null;

  const legacy = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  return { $in: [normalized, legacy] };
}

function getRequesterId(mentorship) {
  return mentorship.requester || mentorship.menteeId;
}

function getRecipientId(mentorship) {
  return mentorship.recipient || mentorship.mentorId;
}

function isPending(mentorship) {
  return toStatus(mentorship.status) === 'pending';
}

function isAccepted(mentorship) {
  return toStatus(mentorship.status) === 'accepted';
}

function isParticipant(mentorship, userId) {
  const userIdString = String(userId);
  const requesterId = getRequesterId(mentorship);
  const recipientId = getRecipientId(mentorship);

  return (
    requesterId && String(requesterId) === userIdString
  ) || (
    recipientId && String(recipientId) === userIdString
  );
}

function isRecipient(mentorship, userId) {
  const recipientId = getRecipientId(mentorship);
  return recipientId && String(recipientId) === String(userId);
}

async function sendEmailSafe(payload) {
  try {
    await sendEmail(payload);
  } catch (error) {
    console.error('Failed to send mentorship notification email:', error.message);
  }
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
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const candidate = generateJoinCode();
    // eslint-disable-next-line no-await-in-loop
    const existing = await Group.findOne({ joinCode: candidate });
    if (!existing) {
      return candidate;
    }
    attempts += 1;
  }

  throw new Error('Unable to generate a unique join code');
}

async function ensureDirectMentorshipGroup(requesterUser, recipientUser) {
  const userA = String(requesterUser._id);
  const userB = String(recipientUser._id);
  const pairKey = [userA, userB].sort().join(':');
  const hash = crypto.createHash('sha1').update(pairKey).digest('hex').slice(0, 18);
  const groupName = `mentorship-${hash}`;

  let group = await Group.findOne({ name: groupName, isActive: true });

  if (!group) {
    const joinCode = await generateUniqueJoinCode();
    const displayName = `Mentorship Chat: ${requesterUser.name} & ${recipientUser.name}`.slice(0, 100);
    const description = 'Private mentorship chat created automatically after request acceptance.';

    group = await Group.create({
      name: groupName,
      displayName,
      description,
      creatorId: requesterUser._id,
      joinCode,
      members: [
        {
          userId: requesterUser._id,
          role: 'owner',
        },
        {
          userId: recipientUser._id,
          role: 'member',
        },
      ],
    });

    return group;
  }

  const requesterMemberExists = group.members.some((member) => String(member.userId) === String(requesterUser._id));
  const recipientMemberExists = group.members.some((member) => String(member.userId) === String(recipientUser._id));

  if (!requesterMemberExists) {
    group.members.push({ userId: requesterUser._id, role: 'member' });
  }

  if (!recipientMemberExists) {
    group.members.push({ userId: recipientUser._id, role: 'member' });
  }

  if (!requesterMemberExists || !recipientMemberExists) {
    await group.save();
  }

  return group;
}

async function acceptMentorshipRequest(req, res) {
  try {
    const mentorship = await Mentorship.findById(req.params.id);

    if (!mentorship) {
      return res.status(404).json({
        success: false,
        message: 'Mentorship request not found',
      });
    }

    if (!isRecipient(mentorship, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'You can only accept requests sent to you',
      });
    }

    if (!isPending(mentorship)) {
      return res.status(400).json({
        success: false,
        message: `Cannot accept request with status: ${mentorship.status}`,
      });
    }

    const requesterId = getRequesterId(mentorship);
    const recipientId = getRecipientId(mentorship);

    const [requesterUser, recipientUser] = await Promise.all([
      User.findById(requesterId),
      User.findById(recipientId),
    ]);

    if (!requesterUser || !recipientUser) {
      return res.status(404).json({
        success: false,
        message: 'Requester or recipient user no longer exists',
      });
    }

    const directChatGroup = await ensureDirectMentorshipGroup(requesterUser, recipientUser);

    await mentorship.accept(directChatGroup._id);
    await mentorship.populate('requester', 'name email department year role profilePicture');
    await mentorship.populate('recipient', 'name email department year role profilePicture');
    await mentorship.populate('mentorId', 'name email department year role profilePicture');
    await mentorship.populate('menteeId', 'name email department year role profilePicture');
    await mentorship.populate('chatGroupId', 'name displayName joinCode');

    const requesterName = requesterUser.name || 'User';
    const recipientName = recipientUser.name || 'User';

    sendEmailSafe({
      to: requesterUser.email,
      subject: 'Your mentorship request has been accepted',
      html: `
        <h2>Mentorship Request Accepted</h2>
        <p>Hello ${requesterName},</p>
        <p>Your mentorship request has been accepted by ${recipientName}.</p>
        <p>You can now start chatting in your Messages tab.</p>
      `,
    });

    sendEmailSafe({
      to: recipientUser.email,
      subject: 'You accepted a mentorship request',
      html: `
        <h2>Mentorship Request Accepted</h2>
        <p>Hello ${recipientName},</p>
        <p>You accepted the mentorship request from ${requesterName}.</p>
        <p>A direct mentorship chat has been created automatically.</p>
      `,
    });

    return res.json({
      success: true,
      message: 'Mentorship request accepted',
      mentorship,
      chatGroup: {
        id: directChatGroup._id,
        name: directChatGroup.name,
        displayName: directChatGroup.displayName,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to accept mentorship request',
      error: error.message,
    });
  }
}

async function rejectMentorshipRequest(req, res) {
  try {
    const rawReason = typeof req.body?.rejectionReason === 'string'
      ? req.body.rejectionReason
      : req.body?.reason;
    const rejectionReason = typeof rawReason === 'string' ? rawReason.trim() : '';

    if (!rejectionReason || rejectionReason.length < MIN_REJECTION_REASON_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Rejection reason is required and must be at least ${MIN_REJECTION_REASON_LENGTH} characters`,
      });
    }

    const mentorship = await Mentorship.findById(req.params.id);

    if (!mentorship) {
      return res.status(404).json({
        success: false,
        message: 'Mentorship request not found',
      });
    }

    if (!isRecipient(mentorship, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'You can only reject requests sent to you',
      });
    }

    if (!isPending(mentorship)) {
      return res.status(400).json({
        success: false,
        message: `Cannot reject request with status: ${mentorship.status}`,
      });
    }

    const requesterId = getRequesterId(mentorship);
    const recipientId = getRecipientId(mentorship);

    const [requesterUser, recipientUser] = await Promise.all([
      User.findById(requesterId),
      User.findById(recipientId),
    ]);

    await mentorship.reject(rejectionReason);
    await mentorship.populate('requester', 'name email department year role profilePicture');
    await mentorship.populate('recipient', 'name email department year role profilePicture');
    await mentorship.populate('mentorId', 'name email department year role profilePicture');
    await mentorship.populate('menteeId', 'name email department year role profilePicture');

    if (requesterUser && recipientUser) {
      sendEmailSafe({
        to: requesterUser.email,
        subject: 'Your mentorship request was rejected',
        html: `
          <h2>Mentorship Request Rejected</h2>
          <p>Hello ${requesterUser.name || 'User'},</p>
          <p>Your mentorship request to ${recipientUser.name || 'User'} was rejected.</p>
          <p><strong>Reason:</strong> ${rejectionReason}</p>
        `,
      });

      sendEmailSafe({
        to: recipientUser.email,
        subject: 'You rejected a mentorship request',
        html: `
          <h2>Mentorship Request Rejected</h2>
          <p>Hello ${recipientUser.name || 'User'},</p>
          <p>You rejected the mentorship request from ${requesterUser.name || 'User'}.</p>
        `,
      });
    }

    return res.json({
      success: true,
      message: 'Mentorship request rejected',
      mentorship,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to reject mentorship request',
      error: error.message,
    });
  }
}

// @route   POST /api/mentorship/request
// @desc    Request mentorship from another user with reason
// @access  Private
router.post('/request', verifyToken, apiLimiter, async (req, res) => {
  try {
    const recipientId = req.body?.recipientId || req.body?.mentorId;
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    const requesterId = req.user._id;

    if (!recipientId) {
      return res.status(400).json({
        success: false,
        message: 'recipientId is required',
      });
    }

    if (!reason || reason.length < MIN_REQUEST_REASON_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Reason is required and must be at least ${MIN_REQUEST_REASON_LENGTH} characters`,
      });
    }

    if (String(recipientId) === String(requesterId)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot request mentorship from yourself',
      });
    }

    const recipient = await User.findById(recipientId);
    if (!recipient || !recipient.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Recipient not found',
      });
    }

    const existingRequest = await Mentorship.findOne({
      $or: [
        { requester: requesterId, recipient: recipientId },
        { requester: recipientId, recipient: requesterId },
        { menteeId: requesterId, mentorId: recipientId },
        { menteeId: recipientId, mentorId: requesterId },
      ],
    });

    if (existingRequest && isPending(existingRequest)) {
      return res.status(400).json({
        success: false,
        message: 'A mentorship request is already pending between these users',
      });
    }

    if (existingRequest && isAccepted(existingRequest)) {
      return res.status(400).json({
        success: false,
        message: 'You are already connected in an active mentorship',
      });
    }

    const mentorshipData = {
      requester: requesterId,
      recipient: recipientId,
      menteeId: requesterId,
      mentorId: recipientId,
      reason,
      rejectionReason: '',
      status: 'pending',
      requestedAt: new Date(),
      acceptedAt: null,
      terminatedAt: null,
      chatGroupId: null,
    };

    const mentorship = existingRequest
      ? await Mentorship.findByIdAndUpdate(existingRequest._id, { $set: mentorshipData }, { new: true, runValidators: true })
      : await Mentorship.create(mentorshipData);

    await mentorship.populate('requester', 'name email department year role profilePicture');
    await mentorship.populate('recipient', 'name email department year role profilePicture');
    await mentorship.populate('mentorId', 'name email department year role profilePicture');
    await mentorship.populate('menteeId', 'name email department year role profilePicture');

    sendEmailSafe({
      to: recipient.email,
      subject: 'New mentorship request received',
      html: `
        <h2>New Mentorship Request</h2>
        <p>Hello ${recipient.name || 'User'},</p>
        <p>You have received a new mentorship request from ${req.user.name || 'a user'}.</p>
        <p><strong>Reason:</strong> ${reason}</p>
        <p>Please review the request in your Mentorship Requests section.</p>
      `,
    });

    sendEmailSafe({
      to: req.user.email,
      subject: 'Mentorship request sent',
      html: `
        <h2>Mentorship Request Sent</h2>
        <p>Hello ${req.user.name || 'User'},</p>
        <p>Your mentorship request was sent to ${recipient.name || 'the selected user'}.</p>
        <p><strong>Reason:</strong> ${reason}</p>
      `,
    });

    res.status(201).json({
      success: true,
      message: 'Mentorship request sent successfully',
      mentorship,
    });
  } catch (error) {
    if (error && error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Mentorship request already exists',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create mentorship request',
      error: error.message,
    });
  }
});

// @route   GET /api/mentorship/requests/incoming
// @desc    Get mentorship requests received by current user
// @access  Private
router.get('/requests/incoming', verifyToken, apiLimiter, async (req, res) => {
  try {
    const statusQuery = buildStatusQuery(req.query?.status);
    const query = {
      $or: [
        { recipient: req.user._id },
        { mentorId: req.user._id },
      ],
    };

    if (statusQuery) {
      query.status = statusQuery;
    }

    const requests = await Mentorship.find(query)
      .populate('requester', 'name email department year role profilePicture skills interests bio')
      .populate('recipient', 'name email department year role profilePicture')
      .populate('mentorId', 'name email department year role profilePicture')
      .populate('menteeId', 'name email department year role profilePicture skills interests bio')
      .populate('chatGroupId', 'name displayName joinCode')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: requests.length,
      requests,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch incoming mentorship requests',
      error: error.message,
    });
  }
});

// @route   GET /api/mentorship/requests/outgoing
// @desc    Get mentorship requests sent by current user
// @access  Private
router.get('/requests/outgoing', verifyToken, apiLimiter, async (req, res) => {
  try {
    const statusQuery = buildStatusQuery(req.query?.status);
    const query = {
      $or: [
        { requester: req.user._id },
        { menteeId: req.user._id },
      ],
    };

    if (statusQuery) {
      query.status = statusQuery;
    }

    const requests = await Mentorship.find(query)
      .populate('requester', 'name email department year role profilePicture')
      .populate('recipient', 'name email department year role profilePicture skills interests bio')
      .populate('mentorId', 'name email department year role profilePicture skills interests bio')
      .populate('menteeId', 'name email department year role profilePicture')
      .populate('chatGroupId', 'name displayName joinCode')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: requests.length,
      requests,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch outgoing mentorship requests',
      error: error.message,
    });
  }
});

// @route   POST /api/mentorship/request/:id/accept
// @desc    Accept mentorship request
// @access  Private (recipient only)
router.post('/request/:id/accept', verifyToken, apiLimiter, acceptMentorshipRequest);

// Legacy support: PUT /api/mentorship/:id/accept
router.put('/:id/accept', verifyToken, apiLimiter, acceptMentorshipRequest);

// @route   POST /api/mentorship/request/:id/reject
// @desc    Reject mentorship request with reason
// @access  Private (recipient only)
router.post('/request/:id/reject', verifyToken, apiLimiter, rejectMentorshipRequest);

// Legacy support: PUT /api/mentorship/:id/reject
router.put('/:id/reject', verifyToken, apiLimiter, rejectMentorshipRequest);

// @route   GET /api/mentorship/my-requests
// @desc    Get user's mentorship requests (both incoming and outgoing)
// @access  Private
router.get('/my-requests', verifyToken, apiLimiter, async (req, res) => {
  try {
    const statusQuery = buildStatusQuery(req.query?.status);
    const query = {
      $or: [
        { requester: req.user._id },
        { recipient: req.user._id },
        { mentorId: req.user._id },
        { menteeId: req.user._id },
      ],
    };

    if (statusQuery) {
      query.status = statusQuery;
    }

    const mentorships = await Mentorship.find(query)
      .populate('requester', 'name email department year role profilePicture skills')
      .populate('recipient', 'name email department year role profilePicture skills')
      .populate('mentorId', 'name email department year role profilePicture skills')
      .populate('menteeId', 'name email department year role profilePicture skills')
      .populate('chatGroupId', 'name displayName joinCode')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: mentorships.length,
      mentorships,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch mentorship requests',
      error: error.message,
    });
  }
});

// @route   GET /api/mentorship/active
// @desc    Get active mentorships
// @access  Private
router.get('/active', verifyToken, apiLimiter, async (req, res) => {
  try {
    const mentorships = await Mentorship.find({
      $or: [
        { requester: req.user._id },
        { recipient: req.user._id },
        { mentorId: req.user._id },
        { menteeId: req.user._id },
      ],
      status: { $in: ['accepted', 'Accepted'] },
    })
      .populate('requester', 'name email department year role profilePicture skills')
      .populate('recipient', 'name email department year role profilePicture skills')
      .populate('mentorId', 'name email department year role profilePicture skills')
      .populate('menteeId', 'name email department year role profilePicture skills')
      .populate('chatGroupId', 'name displayName joinCode')
      .sort({ acceptedAt: -1 });

    res.json({
      success: true,
      count: mentorships.length,
      mentorships,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active mentorships',
      error: error.message,
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
        message: 'Mentorship not found',
      });
    }

    if (!isParticipant(mentorship, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'You are not part of this mentorship',
      });
    }

    if (!isAccepted(mentorship)) {
      return res.status(400).json({
        success: false,
        message: 'Can only terminate accepted mentorships',
      });
    }

    await mentorship.terminate();
    await mentorship.populate('requester', 'name email department year role profilePicture');
    await mentorship.populate('recipient', 'name email department year role profilePicture');
    await mentorship.populate('mentorId', 'name email department');
    await mentorship.populate('menteeId', 'name email department');

    res.json({
      success: true,
      message: 'Mentorship terminated',
      mentorship,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to terminate mentorship',
      error: error.message,
    });
  }
});

module.exports = router;
