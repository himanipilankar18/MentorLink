const express = require('express');
const { Discussion, Comment } = require('../models/Discussion');
const { verifyToken, checkRole } = require('../middleware/auth');
const { validateDiscussion, handleValidationErrors } = require('../middleware/validation');
const { apiLimiter } = require('../middleware/security');

const router = express.Router();

// @route   POST /api/discussions
// @desc    Create a new discussion post
// @access  Private
router.post('/',
  verifyToken,
  apiLimiter,
  validateDiscussion,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { title, content, subjectTag } = req.body;

      const discussion = await Discussion.create({
        authorId: req.user._id,
        title,
        content,
        subjectTag
      });

      await discussion.populate('authorId', 'name email department year role');

      res.status(201).json({
        success: true,
        message: 'Discussion created successfully',
        discussion
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to create discussion',
        error: error.message
      });
    }
  }
);

// @route   GET /api/discussions
// @desc    Get all discussions (with filters)
// @access  Private
router.get('/', verifyToken, apiLimiter, async (req, res) => {
  try {
    const { subjectTag, authorId, isResolved, sortBy = 'createdAt', order = 'desc', limit = 50 } = req.query;

    const query = {};

    if (subjectTag) {
      query.subjectTag = subjectTag;
    }

    if (authorId) {
      query.authorId = authorId;
    }

    if (isResolved !== undefined) {
      query.isResolved = isResolved === 'true';
    }

    const sortOptions = {};
    if (sortBy === 'votes') {
      sortOptions.votes = order === 'asc' ? 1 : -1;
    }
    sortOptions.createdAt = order === 'asc' ? 1 : -1;

    const discussions = await Discussion.find(query)
      .populate('authorId', 'name email department year role')
      .sort(sortOptions)
      .limit(parseInt(limit));

    res.json({
      success: true,
      count: discussions.length,
      discussions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch discussions',
      error: error.message
    });
  }
});

// @route   GET /api/discussions/:id
// @desc    Get single discussion with comments
// @access  Private
router.get('/:id', verifyToken, apiLimiter, async (req, res) => {
  try {
    const discussion = await Discussion.findById(req.params.id)
      .populate('authorId', 'name email department year role');

    if (!discussion) {
      return res.status(404).json({
        success: false,
        message: 'Discussion not found'
      });
    }

    const comments = await Comment.find({ discussionId: discussion._id })
      .populate('authorId', 'name email department year role')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      discussion: {
        ...discussion.toObject(),
        comments
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch discussion',
      error: error.message
    });
  }
});

// @route   POST /api/discussions/:id/comments
// @desc    Add comment to discussion
// @access  Private
router.post('/:id/comments', verifyToken, apiLimiter, async (req, res) => {
  try {
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Comment content is required'
      });
    }

    if (content.length > 2000) {
      return res.status(400).json({
        success: false,
        message: 'Comment cannot exceed 2000 characters'
      });
    }

    const discussion = await Discussion.findById(req.params.id);
    if (!discussion) {
      return res.status(404).json({
        success: false,
        message: 'Discussion not found'
      });
    }

    const comment = await Comment.create({
      discussionId: discussion._id,
      authorId: req.user._id,
      content: content.trim()
    });

    await comment.populate('authorId', 'name email department year role');

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      comment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to add comment',
      error: error.message
    });
  }
});

// @route   PUT /api/discussions/:id/upvote
// @desc    Upvote a discussion
// @access  Private
router.put('/:id/upvote', verifyToken, apiLimiter, async (req, res) => {
  try {
    const discussion = await Discussion.findById(req.params.id);

    if (!discussion) {
      return res.status(404).json({
        success: false,
        message: 'Discussion not found'
      });
    }

    await discussion.upvote(req.user._id);
    await discussion.populate('authorId', 'name email department year role');

    res.json({
      success: true,
      message: 'Discussion upvoted',
      discussion
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to upvote discussion',
      error: error.message
    });
  }
});

// @route   PUT /api/discussions/:id/downvote
// @desc    Downvote a discussion
// @access  Private
router.put('/:id/downvote', verifyToken, apiLimiter, async (req, res) => {
  try {
    const discussion = await Discussion.findById(req.params.id);

    if (!discussion) {
      return res.status(404).json({
        success: false,
        message: 'Discussion not found'
      });
    }

    await discussion.downvote(req.user._id);
    await discussion.populate('authorId', 'name email department year role');

    res.json({
      success: true,
      message: 'Discussion downvoted',
      discussion
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to downvote discussion',
      error: error.message
    });
  }
});

// @route   PUT /api/discussions/:id/resolve
// @desc    Mark discussion as resolved (author only)
// @access  Private
router.put('/:id/resolve', verifyToken, apiLimiter, async (req, res) => {
  try {
    const discussion = await Discussion.findById(req.params.id);

    if (!discussion) {
      return res.status(404).json({
        success: false,
        message: 'Discussion not found'
      });
    }

    if (discussion.authorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the author can mark discussion as resolved'
      });
    }

    discussion.isResolved = true;
    discussion.resolvedAt = new Date();
    await discussion.save();
    await discussion.populate('authorId', 'name email department year role');

    res.json({
      success: true,
      message: 'Discussion marked as resolved',
      discussion
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to resolve discussion',
      error: error.message
    });
  }
});

// @route   GET /api/discussions/stats/by-subject
// @desc    Get discussion statistics by subject tag (for analytics)
// @access  Private
router.get('/stats/by-subject', verifyToken, apiLimiter, async (req, res) => {
  try {
    const stats = await Discussion.aggregate([
      {
        $group: {
          _id: '$subjectTag',
          totalPosts: { $sum: 1 },
          totalVotes: { $sum: '$votes' },
          resolvedCount: {
            $sum: { $cond: ['$isResolved', 1, 0] }
          },
          avgVotes: { $avg: '$votes' }
        }
      },
      { $sort: { totalPosts: -1 } }
    ]);

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch discussion statistics',
      error: error.message
    });
  }
});

module.exports = router;
