const mongoose = require('mongoose');
const Notification = require('../models/Notification');

function sanitizeRelatedId(relatedId) {
  if (!relatedId) return null;
  if (mongoose.Types.ObjectId.isValid(String(relatedId))) {
    return new mongoose.Types.ObjectId(String(relatedId));
  }
  return null;
}

async function createAndEmitNotification({ io, userId, type, message, relatedId = null }) {
  if (!userId || !type || !message) return null;

  const notification = await Notification.create({
    userId,
    type,
    message: String(message).trim(),
    relatedId: sanitizeRelatedId(relatedId),
  });

  const payload = {
    _id: notification._id,
    userId: notification.userId,
    type: notification.type,
    message: notification.message,
    relatedId: notification.relatedId,
    isRead: notification.isRead,
    createdAt: notification.createdAt,
  };

  if (io) {
    io.to(`user:${String(userId)}`).emit('notification:new', payload);
  }

  return payload;
}

module.exports = {
  createAndEmitNotification,
};
