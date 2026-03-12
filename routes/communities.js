const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const Community = require('../models/Community');
const Post = require('../models/Post');
const { verifyToken } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/security');
const router = express.Router();

// Multer setup for community icon/banner uploads
const communityStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join('public', 'uploads', 'communities');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'community-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const communityUpload = multer({
  storage: communityStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
  }
});

// @route   POST /api/communities
// @desc    Create a new community
// @access  Private
router.post('/', verifyToken, apiLimiter, async (req, res) => {
  try {
    const { name, displayName, description, type = 'public', category = 'General', tags = [] } = req.body;

    if (!name || !displayName) {
      return res.status(400).json({
        success: false,
        message: 'Name and display name are required'
      });
    }

    const normalizedName = name.toLowerCase().replace(/\s+/g, '-');

    // Check if community name already exists
    const existing = await Community.findOne({ name: normalizedName });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'A community with this name already exists'
      });
    }

    const community = await Community.create({
      name: normalizedName,
      displayName,
      description,
      type,
      category,
      tags,
      creatorId: req.user._id,
      moderators: [req.user._id],
      members: [{
        userId: req.user._id,
        role: 'admin'
      }]
    });

    await community.populate('creatorId', 'name email profilePicture');

    res.status(201).json({
      success: true,
      message: 'Community created successfully',
      community
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create community',
      error: error.message
    });
  }
});

// @route   GET /api/communities
// @desc    Get all communities
// @access  Private
router.get('/', verifyToken, apiLimiter, async (req, res) => {
  try {
    const { category, search, limit = 50, skip = 0 } = req.query;

    let query = { isActive: true };

    if (category && category !== 'All') {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { displayName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const communities = await Community.find(query)
      .sort({ memberCount: -1, createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .populate('creatorId', 'name profilePicture')
      .lean();

    // Add user membership status
    const communitiesWithStatus = communities.map(community => ({
      ...community,
      isMember: community.members.some(m => m.userId.toString() === req.user._id.toString()),
      memberCount: community.members.length
    }));

    res.json({
      success: true,
      count: communitiesWithStatus.length,
      communities: communitiesWithStatus
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch communities',
      error: error.message
    });
  }
});

// @route   GET /api/communities/my
// @desc    Get user's joined communities
// @access  Private
router.get('/my', verifyToken, apiLimiter, async (req, res) => {
  try {
    const communities = await Community.find({
      'members.userId': req.user._id,
      isActive: true
    })
      .sort({ 'members.joinedAt': -1 })
      .populate('creatorId', 'name profilePicture');

    res.json({
      success: true,
      count: communities.length,
      communities
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch your communities',
      error: error.message
    });
  }
});

// @route   GET /api/communities/:id
// @desc    Get community details
// @access  Private
router.get('/:id', verifyToken, apiLimiter, async (req, res) => {
  try {
    // First load the community without population so membership checks work
    const community = await Community.findById(req.params.id);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found',
      });
    }

    const isMember = community.isMember(req.user._id);
    const isModerator = community.isModerator(req.user._id);
    const isCreator = community.creatorId && community.creatorId.toString
      ? community.creatorId.toString() === req.user._id.toString()
      : false;

    // Now populate related user fields for display
    await community.populate([
      { path: 'creatorId', select: 'name email profilePicture' },
      { path: 'moderators', select: 'name profilePicture' },
      { path: 'members.userId', select: 'name profilePicture' },
    ]);

    res.json({
      success: true,
      community: {
        ...community.toJSON(),
        isMember,
        isModerator,
        isCreator,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch community',
      error: error.message,
    });
  }
});

// @route   POST /api/communities/:id/join
// @desc    Join a community
// @access  Private
router.post('/:id/join', verifyToken, apiLimiter, async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found'
      });
    }

    if (community.type === 'private') {
      return res.status(403).json({
        success: false,
        message: 'This is a private community. You need an invitation to join.'
      });
    }

    if (community.isMember(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: 'You are already a member of this community'
      });
    }

    await community.addMember(req.user._id);

    res.json({
      success: true,
      message: 'Successfully joined the community',
      memberCount: community.members.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to join community',
      error: error.message
    });
  }
});

// @route   POST /api/communities/:id/leave
// @desc    Leave a community
// @access  Private
router.post('/:id/leave', verifyToken, apiLimiter, async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found'
      });
    }

    if (community.creatorId.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Community creator cannot leave. Transfer ownership or delete the community.'
      });
    }

    await community.removeMember(req.user._id);

    res.json({
      success: true,
      message: 'Successfully left the community',
      memberCount: community.members.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to leave community',
      error: error.message
    });
  }
});

// @route   GET /api/communities/:id/posts
// @desc    Get posts from a community
// @access  Private
router.get('/:id/posts', verifyToken, apiLimiter, async (req, res) => {
  try {
    const { limit = 20, skip = 0 } = req.query;

    const community = await Community.findById(req.params.id);
    
    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found'
      });
    }

    // Check if user has access
    if (community.type === 'private' && !community.isMember(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'You need to be a member to view posts'
      });
    }

    const posts = await Post.find({ communityId: req.params.id })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .populate('authorId', 'name email department year role profilePicture')
      .populate('communityId', 'name displayName icon')
      .populate('comments.authorId', 'name profilePicture')
      .lean();

    const formattedPosts = posts.map(post => ({
      ...post,
      likeCount: post.likes.length,
      commentCount: post.comments.length,
      isLiked: post.likes.some(like => like.toString() === req.user._id.toString())
    }));

    res.json({
      success: true,
      count: formattedPosts.length,
      posts: formattedPosts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch community posts',
      error: error.message
    });
  }
});

// @route   POST /api/communities/:id/moderators/:userId
// @desc    Promote a member to moderator
// @access  Private (Creator only)
router.post('/:id/moderators/:userId', verifyToken, apiLimiter, async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found'
      });
    }

    if (!community.creatorId || community.creatorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the community owner can manage moderators'
      });
    }

    const userId = req.params.userId;

    const member = community.members.find(m => m.userId.toString() === userId.toString());
    if (!member) {
      return res.status(400).json({
        success: false,
        message: 'User must be a member of the community to become a moderator'
      });
    }

    member.role = 'moderator';

    if (!community.moderators.some(m => m.toString() === userId.toString())) {
      community.moderators.push(userId);
    }

    await community.save();

    await community.populate([
      { path: 'creatorId', select: 'name email profilePicture' },
      { path: 'moderators', select: 'name profilePicture' },
      { path: 'members.userId', select: 'name profilePicture' },
    ]);

    res.json({
      success: true,
      message: 'User promoted to moderator',
      community,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to promote moderator',
      error: error.message,
    });
  }
});

// @route   DELETE /api/communities/:id/moderators/:userId
// @desc    Remove a moderator back to regular member
// @access  Private (Creator only)
router.delete('/:id/moderators/:userId', verifyToken, apiLimiter, async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found'
      });
    }

    if (!community.creatorId || community.creatorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the community owner can manage moderators'
      });
    }

    const userId = req.params.userId;

    // Do not allow removing the creator from moderator/admin role
    if (community.creatorId.toString() === userId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Community owner cannot be removed as moderator'
      });
    }

    // Update member role back to regular member
    const member = community.members.find(m => m.userId.toString() === userId.toString());
    if (member) {
      member.role = 'member';
    }

    community.moderators = community.moderators.filter(m => m.toString() !== userId.toString());

    await community.save();

    await community.populate([
      { path: 'creatorId', select: 'name email profilePicture' },
      { path: 'moderators', select: 'name profilePicture' },
      { path: 'members.userId', select: 'name profilePicture' },
    ]);

    res.json({
      success: true,
      message: 'Moderator removed successfully',
      community,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to remove moderator',
      error: error.message,
    });
  }
});

// @route   PUT /api/communities/:id
// @desc    Update community
// @access  Private (Moderator only)
router.put('/:id', verifyToken, apiLimiter, async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found'
      });
    }

    if (!community.isModerator(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Only moderators can update the community'
      });
    }

    const { displayName, description, type, category, icon, banner, rules, tags, settings } = req.body;

    if (displayName) community.displayName = displayName;
    if (description) community.description = description;
    if (type) community.type = type;
    if (category) community.category = category;
    if (icon !== undefined) community.icon = icon;
    if (banner !== undefined) community.banner = banner;
    if (rules) community.rules = rules;
    if (tags) community.tags = tags;
    if (settings) community.settings = { ...community.settings, ...settings };

    await community.save();

    res.json({
      success: true,
      message: 'Community updated successfully',
      community
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update community',
      error: error.message
    });
  }
});

// @route   PUT /api/communities/:id/assets
// @desc    Update community icon/banner (and optional text fields) with file uploads
// @access  Private (Moderator only)
router.put('/:id/assets', verifyToken, apiLimiter, communityUpload.fields([
  { name: 'icon', maxCount: 1 },
  { name: 'banner', maxCount: 1 }
]), async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found'
      });
    }

    if (!community.isModerator(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Only moderators can update the community'
      });
    }

    const { displayName, description } = req.body;

    if (displayName) community.displayName = displayName;
    if (description) community.description = description;

    if (req.files && req.files.icon && req.files.icon[0]) {
      const iconFile = req.files.icon[0];
      community.icon = `/uploads/communities/${iconFile.filename}`;
    }

    if (req.files && req.files.banner && req.files.banner[0]) {
      const bannerFile = req.files.banner[0];
      community.banner = `/uploads/communities/${bannerFile.filename}`;
    }

    await community.save();

    res.json({
      success: true,
      message: 'Community updated successfully',
      community
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update community',
      error: error.message
    });
  }
});

// @route   DELETE /api/communities/:id
// @desc    Delete community
// @access  Private (Creator only)
router.delete('/:id', verifyToken, apiLimiter, async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found'
      });
    }

    if (community.creatorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the creator can delete the community'
      });
    }

    await community.deleteOne();

    res.json({
      success: true,
      message: 'Community deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete community',
      error: error.message
    });
  }
});

module.exports = router;
