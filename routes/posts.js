const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const Post = require('../models/Post');
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/security');
const { createAndEmitNotification } = require('../utils/notifications');
const { getUploadSubdirPath } = require('../utils/uploads');
const router = express.Router();

// Multer setup for post image uploads (used by community create-post modal)
const postImageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = getUploadSubdirPath('posts');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'post-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const postImageUpload = multer({
  storage: postImageStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
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

// Separate image upload endpoint so existing JSON /api/posts stays unchanged
// @route   POST /api/posts/upload-image
// @desc    Upload an image for a post and return its URL
// @access  Private
router.post('/upload-image', verifyToken, apiLimiter, postImageUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    const imageUrl = `/uploads/posts/${req.file.filename}`;

    res.json({
      success: true,
      message: 'Image uploaded successfully',
      imageUrl
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to upload image',
      error: error.message
    });
  }
});

// @route   POST /api/posts
// @desc    Create a new post
// @access  Private
router.post('/', verifyToken, apiLimiter, async (req, res) => {
  try {
    const { content, title, communityId, visibility = 'public', imageUrl } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Content is required'
      });
    }

    const postData = {
      authorId: req.user._id,
      content: content.trim(),
      visibility
    };

    if (title) postData.title = title.trim();
    if (communityId) postData.communityId = communityId;

    if (imageUrl && typeof imageUrl === 'string' && imageUrl.trim()) {
      postData.media = [{
        type: 'image',
        url: imageUrl.trim()
      }];
    }

    const post = await Post.create(postData);

    await post.populate('authorId', 'name email department year role profilePicture');
    if (communityId) {
      await post.populate('communityId', 'name displayName icon');
    }

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      post
    });
  } catch (error) {
    console.error('Error creating post:', error);

    const status = error.name === 'ValidationError' ? 400 : 500;

    res.status(status).json({
      success: false,
      // Expose the underlying message so the frontend can show it
      message: error.message || 'Failed to create post',
      error: error.message
    });
  }
});

// @route   GET /api/posts/feed
// @desc    Get feed posts (supports mode=all|following|popular)
// @access  Private
router.get('/feed', verifyToken, apiLimiter, async (req, res) => {
  try {
    const { limit = 20, skip = 0, mode = 'all' } = req.query;

    const baseQuery = {
      visibility: 'public',
      communityId: null // Only personal posts in main feed
    };

    // When mode=following, restrict to authors the current user follows (plus own posts)
    if (mode === 'following') {
      const me = req.user;
      // req.user.following may not be populated, so we re-query to be safe
      const meDoc = await require('../models/User').findById(me._id).select('following');
      const followingIds = meDoc?.following || [];
      baseQuery.authorId = { $in: [req.user._id, ...followingIds] };
    }

    let sort = { createdAt: -1 };
    if (mode === 'popular') {
      // Sort by like count (desc), then most recent
      sort = { likeCount: -1, createdAt: -1 };
    }

    const posts = await Post.aggregate([
      { $match: baseQuery },
      {
        $addFields: {
          likeCount: { $size: '$likes' },
          commentCount: { $size: '$comments' }
        }
      },
      { $sort: sort },
      { $skip: parseInt(skip) },
      { $limit: parseInt(limit) }
    ]);

    // Re-populate author and comment authors after aggregation
    const postIds = posts.map(p => p._id);
    const populated = await Post.find({ _id: { $in: postIds } })
      .populate('authorId', 'name email department year role profilePicture')
      .populate('comments.authorId', 'name profilePicture')
      .lean();

    // Merge like/comment counts and filter out posts whose author no longer exists
    const countsById = new Map(posts.map(p => [String(p._id), { likeCount: p.likeCount, commentCount: p.commentCount }]));

    const formattedPosts = populated
      .filter(post => post.authorId && post.authorId._id)
      .map(post => {
        const counts = countsById.get(String(post._id)) || { likeCount: post.likes.length, commentCount: post.comments.length };
        return {
          ...post,
          likeCount: counts.likeCount,
          commentCount: counts.commentCount,
          isLiked: post.likes.some(like => like.toString() === req.user._id.toString())
        };
      })
      // Ensure order matches aggregation order
      .sort((a, b) => postIds.indexOf(a._id) - postIds.indexOf(b._id));

    res.json({
      success: true,
      posts: formattedPosts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch feed',
      error: error.message
    });
  }
});

// @route   GET /api/posts/:id
// @desc    Get a single post
// @access  Private
router.get('/:id', verifyToken, apiLimiter, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('authorId', 'name email department year role profilePicture')
      .populate('comments.authorId', 'name profilePicture');

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Increment view count
    post.views += 1;
    await post.save();

    res.json({
      success: true,
      post
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch post',
      error: error.message
    });
  }
});

// @route   POST /api/posts/:id/like
// @desc    Like/unlike a post
// @access  Private
router.post('/:id/like', verifyToken, apiLimiter, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    await post.toggleLike(req.user._id);
    
    const isLiked = post.likes.includes(req.user._id);

    // Notify post owner only when someone else likes their post.
    if (isLiked && String(post.authorId) !== String(req.user._id)) {
      try {
        const actor = await User.findById(req.user._id).select('name');
        const actorName = actor?.name || 'Someone';
        const io = req.app.get('io');

        await createAndEmitNotification({
          io,
          userId: post.authorId,
          type: 'POST_LIKED',
          message: `${actorName} liked your post`,
          relatedId: post._id,
        });
      } catch (notificationError) {
        console.error('Failed to create like notification:', notificationError.message);
      }
    }

    res.json({
      success: true,
      message: isLiked ? 'Post liked' : 'Post unliked',
      isLiked,
      likeCount: post.likes.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to toggle like',
      error: error.message
    });
  }
});

// @route   POST /api/posts/:id/comment
// @desc    Add a comment to a post
// @access  Private
router.post('/:id/comment', verifyToken, apiLimiter, async (req, res) => {
  try {
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Comment content is required'
      });
    }

    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    await post.addComment(req.user._id, content.trim());
    await post.populate('comments.authorId', 'name profilePicture');

    // Notify post owner when someone else comments on their post.
    if (String(post.authorId) !== String(req.user._id)) {
      try {
        const actor = await User.findById(req.user._id).select('name');
        const actorName = actor?.name || 'Someone';
        const io = req.app.get('io');

        await createAndEmitNotification({
          io,
          userId: post.authorId,
          type: 'POST_COMMENTED',
          message: `${actorName} commented on your post`,
          relatedId: post._id,
        });
      } catch (notificationError) {
        console.error('Failed to create comment notification:', notificationError.message);
      }
    }

    res.json({
      success: true,
      message: 'Comment added successfully',
      comments: post.comments
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to add comment',
      error: error.message
    });
  }
});

async function deleteOwnCommentHandler(req, res) {
  try {
    const { id: postId, commentId } = req.params;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    const targetComment = post.comments.id(commentId);
    if (!targetComment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found'
      });
    }

    if (String(targetComment.authorId) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this comment'
      });
    }

    targetComment.deleteOne();
    await post.save();

    return res.json({
      success: true,
      message: 'Comment deleted successfully',
      commentCount: post.comments.length
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete comment',
      error: error.message
    });
  }
}

// @route   DELETE /api/posts/:id/comment/:commentId
// @desc    Delete own comment from a post
// @access  Private (Comment author only)
router.delete('/:id/comment/:commentId', verifyToken, apiLimiter, deleteOwnCommentHandler);

// Backward-compatible alias
router.delete('/:id/comments/:commentId', verifyToken, apiLimiter, deleteOwnCommentHandler);

// @route   DELETE /api/posts/:id
// @desc    Delete a post
// @access  Private (Author only)
router.delete('/:id', verifyToken, apiLimiter, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Check if user is the author
    if (post.authorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this post'
      });
    }

    await post.deleteOne();

    res.json({
      success: true,
      message: 'Post deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete post',
      error: error.message
    });
  }
});

// @route   GET /api/posts/user/:userId
// @desc    Get posts by a specific user (scope=personal|community|all)
// @access  Private
router.get('/user/:userId', verifyToken, apiLimiter, async (req, res) => {
  try {
    const { limit = 20, skip = 0, scope = 'personal' } = req.query;

    const query = {
      authorId: req.params.userId,
      visibility: { $in: ['public', 'friends'] }
    };

    // Keep personal and community posts explicitly separated for profile tabs.
    if (scope === 'community') {
      query.communityId = { $ne: null };
    } else if (scope === 'personal') {
      query.communityId = null;
    }

    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .populate('authorId', 'name email department year role profilePicture')
      .populate('communityId', 'name displayName icon')
      .populate('comments.authorId', 'name profilePicture');

    res.json({
      success: true,
      posts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user posts',
      error: error.message
    });
  }
});

module.exports = router;
