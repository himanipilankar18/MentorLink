const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const Post = require('../models/Post');
const { verifyToken } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/security');
const router = express.Router();

// Multer setup for post image uploads (used by community create-post modal)
const postImageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join('public', 'uploads', 'posts');
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
// @desc    Get feed posts
// @access  Private
router.get('/feed', verifyToken, apiLimiter, async (req, res) => {
  try {
    const { limit = 20, skip = 0 } = req.query;

    const posts = await Post.find({ 
      visibility: 'public',
      communityId: null // Only personal posts in main feed
    })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .populate('authorId', 'name email department year role profilePicture')
      .populate('comments.authorId', 'name profilePicture')
      .lean();

    // Filter out posts whose author no longer exists to avoid
    // showing legacy "Anonymous" entries from deleted users.
    const visiblePosts = posts.filter(post => post.authorId && post.authorId._id);

    // Add like count and format data
    const formattedPosts = visiblePosts.map(post => ({
      ...post,
      likeCount: post.likes.length,
      commentCount: post.comments.length,
      isLiked: post.likes.some(like => like.toString() === req.user._id.toString())
    }));

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
// @desc    Get posts by a specific user
// @access  Private
router.get('/user/:userId', verifyToken, apiLimiter, async (req, res) => {
  try {
    const { limit = 20, skip = 0 } = req.query;

    const posts = await Post.find({ 
      authorId: req.params.userId,
      visibility: { $in: ['public', 'friends'] }
    })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .populate('authorId', 'name email department year role profilePicture')
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
