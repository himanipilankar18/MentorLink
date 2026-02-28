require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

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

    // Delete all users
    const result = await User.deleteMany({});
    console.log(`✅ Successfully deleted ${result.deletedCount} users from database`);

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
