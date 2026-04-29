#!/usr/bin/env node
/*
Fix mentorship DM visibility for a mentor/mentee pair by name.
- Finds user IDs for both names
- Ensures accepted mentorship exists and is linked to a chat group
- Ensures both users are members of the group
- Prints actions taken
*/

const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const User = require('../models/User');
const Mentorship = require('../models/Mentorship');
const Group = require('../models/Group');

const menteeName = 'Tithi Talele';
const mentorName = 'Himani Pilankar';

async function main() {
  await connectDB();
  try {
    const mentee = await User.findOne({ name: menteeName });
    const mentor = await User.findOne({ name: mentorName });
    if (!mentee || !mentor) {
      console.error('Could not find both users:', { mentee: !!mentee, mentor: !!mentor });
      process.exit(1);
    }
    console.log('Found users:', { mentee: mentee._id, mentor: mentor._id });

    let mentorship = await Mentorship.findOne({ mentorId: mentor._id, menteeId: mentee._id });
    if (!mentorship) {
      mentorship = await Mentorship.create({
        mentorId: mentor._id,
        menteeId: mentee._id,
        status: 'accepted',
        requestedAt: new Date(),
        acceptedAt: new Date(),
      });
      console.log('Created new mentorship:', mentorship._id);
    } else if (mentorship.status !== 'accepted') {
      mentorship.status = 'accepted';
      mentorship.acceptedAt = new Date();
      await mentorship.save();
      console.log('Updated mentorship to accepted:', mentorship._id);
    } else {
      console.log('Mentorship already accepted:', mentorship._id);
    }

    // Find or create the chat group
    const userA = String(mentee._id);
    const userB = String(mentor._id);
    const pairKey = [userA, userB].sort().join(':');
    const crypto = require('crypto');
    const hash = crypto.createHash('sha1').update(pairKey).digest('hex').slice(0, 18);
    const groupName = `mentorship-${hash}`;
    let group = await Group.findOne({ name: groupName, isActive: true });
    if (!group) {
      const joinCode = Math.random().toString(36).substr(2, 6).toUpperCase();
      const displayName = `Direct: ${mentor.name} & ${mentee.name}`.slice(0, 100);
      group = await Group.create({
        name: groupName,
        displayName,
        description: 'Private mentorship chat',
        creatorId: mentor._id,
        joinCode,
        members: [
          { userId: mentor._id, role: 'owner' },
          { userId: mentee._id, role: 'member' },
        ],
      });
      console.log('Created new group:', group._id);
    } else {
      // Ensure both users are members
      let changed = false;
      if (!group.members.some(m => String(m.userId) === String(mentor._id))) {
        group.members.push({ userId: mentor._id, role: 'owner' });
        changed = true;
      }
      if (!group.members.some(m => String(m.userId) === String(mentee._id))) {
        group.members.push({ userId: mentee._id, role: 'member' });
        changed = true;
      }
      if (changed) {
        await group.save();
        console.log('Updated group membership:', group._id);
      } else {
        console.log('Group already has both members:', group._id);
      }
    }

    // Link mentorship to group
    if (!mentorship.chatGroupId || String(mentorship.chatGroupId) !== String(group._id)) {
      mentorship.chatGroupId = group._id;
      await mentorship.save();
      console.log('Linked mentorship to group:', group._id);
    } else {
      console.log('Mentorship already linked to group:', group._id);
    }

    console.log('Done. Both users should now see the DM if frontend is correct.');
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
    try { await mongoose.disconnect(); } catch (e) {}
    process.exit(1);
  }
}

main();
