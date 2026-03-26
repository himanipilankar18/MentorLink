const express = require('express');
const Notification = require('../models/Notification');
const { verifyToken } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/security');

const router = express.Router();

// @route   GET /api/notifications
// @desc    Get current user's notifications (optionally unread only)
// @access  Private
router.get('/', verifyToken, apiLimiter, async (req, res) => {
  try {
    const unreadOnly = String(req.query.unread || '').toLowerCase() === 'true';
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);

    const query = { userId: req.user._id };
    if (unreadOnly) {
      query.isRead = false;
    }

    const [notifications, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
      Notification.countDocuments({ userId: req.user._id, isRead: false }),
    ]);

    return res.json({
      success: true,
      count: notifications.length,
      unreadCount,
      notifications,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error.message,
    });
  }
});

// @route   PUT /api/notifications/:id/read
// @desc    Mark single notification as read
// @access  Private
router.put('/:id/read', verifyToken, apiLimiter, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user._id,
      },
      {
        $set: { isRead: true },
      },
      { new: true }
    ).lean();

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    const unreadCount = await Notification.countDocuments({ userId: req.user._id, isRead: false });

    return res.json({
      success: true,
      message: 'Notification marked as read',
      unreadCount,
      notification,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update notification',
      error: error.message,
    });
  }
});

// @route   PUT /api/notifications/read-all
// @desc    Mark all notifications as read
// @access  Private
router.put('/read-all', verifyToken, apiLimiter, async (req, res) => {
  try {
    const updateResult = await Notification.updateMany(
      { userId: req.user._id, isRead: false },
      { $set: { isRead: true } }
    );

    return res.json({
      success: true,
      message: 'All notifications marked as read',
      updatedCount: updateResult.modifiedCount || 0,
      unreadCount: 0,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read',
      error: error.message,
    });
  }
});

module.exports = router;
