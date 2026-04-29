#!/usr/bin/env node
/*
 Safe script to clear all forum (discussion + comment) data.
 Usage:
   node scripts/clear-forums.js --force   # delete without interactive prompt
   node scripts/clear-forums.js           # preview + interactive confirmation

 The script writes a JSON backup to ./scripts/backup/ before deleting.
 Requires MONGODB_URI in the environment or in .env.
*/

const path = require('path');
const fs = require('fs');
const readline = require('readline');

require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const connectDB = require('../config/database');
const mongoose = require('mongoose');
const { Discussion, Comment } = require('../models/Discussion');

async function promptYesNo(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question + ' (yes/no): ', (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'yes');
    });
  });
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { force: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--force') out.force = true;
  }
  return out;
}

async function main() {
  const opts = parseArgs();

  await connectDB();

  try {
    const discussionCount = await Discussion.countDocuments();
    const commentCount = await Comment.countDocuments();

    console.log('\n=== Forum Delete Preview ===');
    console.log('Discussions found: ', discussionCount);
    console.log('Comments found: ', commentCount);

    if (discussionCount === 0 && commentCount === 0) {
      console.log('No forum data present. Nothing to delete.');
      await mongoose.disconnect();
      return;
    }

    // Ensure backup folder
    const backupDir = path.join(__dirname, 'backup');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `forums-backup-${timestamp}.json`);

    // Read all documents (beware of very large collections)
    const discussions = await Discussion.find({}).lean();
    const comments = await Comment.find({}).lean();

    const backup = {
      timestamp: new Date().toISOString(),
      counts: { discussions: discussions.length, comments: comments.length },
      discussions,
      comments
    };

    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2), 'utf8');
    console.log('\nBackup written to: %s', backupFile);

    if (!opts.force) {
      const confirmed = await promptYesNo('\nProceed to permanently DELETE all forum discussions and comments?');
      if (!confirmed) {
        console.log('Aborted by user. No changes made.');
        await mongoose.disconnect();
        return;
      }
    }

    // Perform deletions
    const delComments = await Comment.deleteMany({});
    console.log(`Deleted ${delComments.deletedCount || 0} comments.`);

    const delDiscussions = await Discussion.deleteMany({});
    console.log(`Deleted ${delDiscussions.deletedCount || 0} discussions.`);

    console.log('\nDone.');
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error during forum delete operation:', err);
    try { await mongoose.disconnect(); } catch (e) {}
    process.exit(1);
  }
}

main();
