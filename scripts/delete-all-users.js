require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Post = require('../models/Post');
const ChatMessage = require('../models/ChatMessage');
const { Discussion, Comment } = require('../models/Discussion');
const Interaction = require('../models/Interaction');

async function deleteAllUsers() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected Successfully');

    // Count users before deletion
    const countBefore = await User.countDocuments();
    console.log(`\nFound ${countBefore} users in database`);

    if (countBefore === 0) {
      console.log('No users to delete.');
      process.exit(0);
    }

    // Ask for confirmation
    console.log('\n⚠️  WARNING: This will DELETE ALL USERS from the database!');
    console.log('Press Ctrl+C now to cancel, or wait 3 seconds to proceed...\n');

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Delete all users and their related content
    const userResult = await User.deleteMany({});
    console.log(`✅ Deleted ${userResult.deletedCount} users`);

    const postResult = await Post.deleteMany({});
    console.log(`🧹 Deleted ${postResult.deletedCount} posts`);

    const chatResult = await ChatMessage.deleteMany({});
    console.log(`🧹 Deleted ${chatResult.deletedCount} chat messages`);

    const discussionResult = await Discussion.deleteMany({});
    const commentResult = await Comment.deleteMany({});
    console.log(`🧹 Deleted ${discussionResult.deletedCount} discussions and ${commentResult.deletedCount} discussion comments`);

    const interactionResult = await Interaction.deleteMany({});
    console.log(`🧹 Deleted ${interactionResult.deletedCount} interactions`);

    // Verify deletion
    const countAfter = await User.countDocuments();
    console.log(`Remaining users: ${countAfter}\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error deleting users:', error.message);
    process.exit(1);
  }
}

deleteAllUsers();
