require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Post = require('../models/Post');
const ChatMessage = require('../models/ChatMessage');

async function cleanupOrphanContent() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected Successfully');

    const userIds = await User.find({}, { _id: 1 }).lean();
    const idList = userIds.map(u => u._id);
    console.log(`Found ${idList.length} active user IDs`);

    // Delete posts whose author no longer exists
    const postResult = await Post.deleteMany({ authorId: { $nin: idList } });
    console.log(`🧹 Deleted ${postResult.deletedCount} posts with missing authors`);

    // Delete chat messages whose sender no longer exists
    const chatResult = await ChatMessage.deleteMany({ senderId: { $nin: idList } });
    console.log(`🧹 Deleted ${chatResult.deletedCount} chat messages with missing senders`);

    console.log('Cleanup complete.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during orphan content cleanup:', error.message);
    process.exit(1);
  }
}

cleanupOrphanContent();
