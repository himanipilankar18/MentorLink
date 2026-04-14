const jwt = require('jsonwebtoken');
const Group = require('../models/Group');
const User = require('../models/User');

const activeConnections = new Map(); // Map<userId, Set<socketId>>

function getBearerToken(value) {
  if (!value || typeof value !== 'string') return '';
  if (value.startsWith('Bearer ')) {
    return value.slice(7).trim();
  }
  return value.trim();
}

function addConnection(userId, socketId) {
  const key = String(userId);
  const existingSet = activeConnections.get(key);

  if (existingSet) {
    existingSet.add(socketId);
    return false;
  }

  activeConnections.set(key, new Set([socketId]));
  return true;
}

function removeConnection(userId, socketId) {
  const key = String(userId);
  const sockets = activeConnections.get(key);

  if (!sockets) {
    return { isLastConnection: false };
  }

  sockets.delete(socketId);

  if (sockets.size > 0) {
    return { isLastConnection: false };
  }

  activeConnections.delete(key);
  return { isLastConnection: true };
}

async function ensureGroupMembership(groupId, userId) {
  if (!groupId) return false;

  const group = await Group.findOne({
    _id: groupId,
    isActive: true,
    'members.userId': userId,
  }).select('_id');

  return !!group;
}

async function findDirectGroupForUsers(groupId, userId, targetUserId) {
  if (!groupId || !userId || !targetUserId) return null;

  const group = await Group.findOne({
    _id: groupId,
    isActive: true,
    name: /^direct-/,
    'members.userId': { $all: [userId, targetUserId] },
  }).select('_id name members');

  return group || null;
}

function setupSocketServer(io) {
  io.use(async (socket, next) => {
    try {
      const authToken = socket.handshake?.auth?.token;
      const queryToken = socket.handshake?.query?.token;
      const headerToken = socket.handshake?.headers?.authorization;
      const token = getBearerToken(authToken || queryToken || headerToken);

      if (!token) {
        return next(new Error('Authentication token is required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('_id isActive');

      if (!user || !user.isActive) {
        return next(new Error('Unauthorized socket user'));
      }

      socket.data.userId = String(user._id);
      socket.data.groupIds = new Set();
      socket.data.typingEventTimestamps = new Map();

      return next();
    } catch (error) {
      return next(new Error('Socket authentication failed'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.data.userId;
    socket.join(`user:${userId}`);
    const isFirstConnection = addConnection(userId, socket.id);

    if (isFirstConnection) {
      try {
        await User.findByIdAndUpdate(userId, {
          $set: {
            isOnline: true,
          },
        });
      } catch (error) {
        console.error('Failed to mark user online:', error.message);
      }

      io.emit('user:online', { userId });
    }

    socket.on('group:join', async (payload) => {
      try {
        const groupId = payload && payload.groupId ? String(payload.groupId) : '';
        if (!groupId) return;

        const isMember = await ensureGroupMembership(groupId, userId);
        if (!isMember) return;

        socket.join(`group:${groupId}`);
        socket.data.groupIds.add(groupId);
      } catch (error) {
        console.error('Failed to join socket group room:', error.message);
      }
    });

    socket.on('typing:start', (payload) => {
      const groupId = payload && payload.groupId ? String(payload.groupId) : '';
      if (!groupId || !socket.data.groupIds.has(groupId)) return;

      const spamKey = `typing:start:${groupId}`;
      const now = Date.now();
      const previousTs = socket.data.typingEventTimestamps.get(spamKey) || 0;

      if (now - previousTs < 300) {
        return;
      }

      socket.data.typingEventTimestamps.set(spamKey, now);

      socket.to(`group:${groupId}`).emit('typing:start', {
        groupId,
        userId,
      });
    });

    socket.on('typing:stop', (payload) => {
      const groupId = payload && payload.groupId ? String(payload.groupId) : '';
      if (!groupId || !socket.data.groupIds.has(groupId)) return;

      const spamKey = `typing:stop:${groupId}`;
      const now = Date.now();
      const previousTs = socket.data.typingEventTimestamps.get(spamKey) || 0;

      if (now - previousTs < 300) {
        return;
      }

      socket.data.typingEventTimestamps.set(spamKey, now);

      socket.to(`group:${groupId}`).emit('typing:stop', {
        groupId,
        userId,
      });
    });

    // Caller starts ringing target user for a direct-message call.
    socket.on('call:ring', async (payload) => {
      try {
        const groupId = payload && payload.groupId ? String(payload.groupId) : '';
        const targetUserId = payload && payload.targetUserId ? String(payload.targetUserId) : '';
        const callId = payload && payload.callId ? String(payload.callId) : '';

        if (!groupId || !targetUserId || !callId || targetUserId === userId) {
          return;
        }

        const group = await findDirectGroupForUsers(groupId, userId, targetUserId);
        if (!group) {
          socket.emit('call:error', {
            groupId,
            callId,
            message: 'Direct call not allowed for this chat',
          });
          return;
        }

        io.to(`user:${targetUserId}`).emit('call:incoming', {
          groupId,
          callId,
          fromUserId: userId,
          callerName: payload && payload.callerName ? String(payload.callerName) : 'Someone',
          offer: payload ? payload.offer : null,
          at: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Failed to process call:ring event:', error.message);
      }
    });

    socket.on('call:accept', async (payload) => {
      try {
        const groupId = payload && payload.groupId ? String(payload.groupId) : '';
        const targetUserId = payload && payload.targetUserId ? String(payload.targetUserId) : '';
        const callId = payload && payload.callId ? String(payload.callId) : '';

        if (!groupId || !targetUserId || !callId || targetUserId === userId) {
          return;
        }

        const group = await findDirectGroupForUsers(groupId, userId, targetUserId);
        if (!group) return;

        io.to(`user:${targetUserId}`).emit('call:accepted', {
          groupId,
          callId,
          fromUserId: userId,
          answer: payload ? payload.answer : null,
          at: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Failed to process call:accept event:', error.message);
      }
    });

    socket.on('call:decline', async (payload) => {
      try {
        const groupId = payload && payload.groupId ? String(payload.groupId) : '';
        const targetUserId = payload && payload.targetUserId ? String(payload.targetUserId) : '';
        const callId = payload && payload.callId ? String(payload.callId) : '';

        if (!groupId || !targetUserId || !callId || targetUserId === userId) {
          return;
        }

        const group = await findDirectGroupForUsers(groupId, userId, targetUserId);
        if (!group) return;

        io.to(`user:${targetUserId}`).emit('call:declined', {
          groupId,
          callId,
          fromUserId: userId,
          reason: payload && payload.reason ? String(payload.reason) : 'declined',
          at: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Failed to process call:decline event:', error.message);
      }
    });

    socket.on('call:end', async (payload) => {
      try {
        const groupId = payload && payload.groupId ? String(payload.groupId) : '';
        const targetUserId = payload && payload.targetUserId ? String(payload.targetUserId) : '';
        const callId = payload && payload.callId ? String(payload.callId) : '';

        if (!groupId || !targetUserId || !callId || targetUserId === userId) {
          return;
        }

        const group = await findDirectGroupForUsers(groupId, userId, targetUserId);
        if (!group) return;

        io.to(`user:${targetUserId}`).emit('call:ended', {
          groupId,
          callId,
          fromUserId: userId,
          at: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Failed to process call:end event:', error.message);
      }
    });

    socket.on('webrtc:ice', async (payload) => {
      try {
        const groupId = payload && payload.groupId ? String(payload.groupId) : '';
        const targetUserId = payload && payload.targetUserId ? String(payload.targetUserId) : '';
        const callId = payload && payload.callId ? String(payload.callId) : '';

        if (!groupId || !targetUserId || !callId || targetUserId === userId) {
          return;
        }

        const group = await findDirectGroupForUsers(groupId, userId, targetUserId);
        if (!group) return;

        io.to(`user:${targetUserId}`).emit('webrtc:ice', {
          groupId,
          callId,
          fromUserId: userId,
          candidate: payload ? payload.candidate : null,
        });
      } catch (error) {
        console.error('Failed to process webrtc:ice event:', error.message);
      }
    });

    socket.on('disconnect', async () => {
      const { isLastConnection } = removeConnection(userId, socket.id);

      if (!isLastConnection) {
        return;
      }

      const now = new Date();

      try {
        await User.findByIdAndUpdate(userId, {
          $set: {
            isOnline: false,
            lastActiveAt: now,
          },
        });
      } catch (error) {
        console.error('Failed to mark user offline:', error.message);
      }

      io.emit('user:offline', {
        userId,
        timestamp: now.toISOString(),
      });
    });
  });
}

module.exports = {
  setupSocketServer,
};
