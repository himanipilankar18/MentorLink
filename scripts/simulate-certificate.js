require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('../config/database');
const User = require('../models/User');
const Mentorship = require('../models/Mentorship');
const Interaction = require('../models/Interaction');
const { awardForConfirmedInteraction, getContributionStats } = require('../utils/contributionService');
const Achievement = require('../models/Achievement');
const Certificate = require('../models/Certificate');

async function run() {
  const mentorEmail = String(process.argv[2] || '').trim().toLowerCase();
  if (!mentorEmail) throw new Error('Usage: node scripts/simulate-certificate.js mentor@example.com');

  await connectDB();
  const mentor = await User.findOne({ email: mentorEmail });
  if (!mentor) throw new Error(`No user found for ${mentorEmail}`);

  const mentees = await User.find({ _id: { $ne: mentor._id }, isActive: true }).limit(2);
  if (mentees.length < 2) throw new Error('At least two active users are required as synthetic mentees');

  for (let index = 0; index < 3; index += 1) {
    const mentee = mentees[index % mentees.length];
    let mentorship = await Mentorship.findOne({ mentorId: mentor._id, menteeId: mentee._id });
    if (!mentorship) {
      mentorship = await Mentorship.create({ mentorId: mentor._id, menteeId: mentee._id, requester: mentee._id, recipient: mentor._id, status: 'accepted', acceptedAt: new Date() });
    } else if (String(mentorship.status).toLowerCase() !== 'accepted') {
      mentorship.status = 'accepted';
      mentorship.acceptedAt = mentorship.acceptedAt || new Date();
      await mentorship.save();
    }
    const interaction = await Interaction.create({ mentorId: mentor._id, menteeId: mentee._id, mentorshipId: mentorship._id, topic: `Synthetic mentoring session ${index + 1}`, subjectTag: 'Other', interactionType: 'Chat', duration: 35, satisfactionRating: 5, outcomeStatus: 'resolved', menteeWouldRecommend: true, followUpCompleted: true, confirmationStatus: 'confirmed', confirmedAt: new Date() });
    await awardForConfirmedInteraction(interaction._id);
  }

  const stats = await getContributionStats(mentor._id);
  const achievement = await Achievement.findOne({ mentorId: mentor._id }).sort({ level: -1 }).lean();
  const certificate = achievement ? await Certificate.findOne({ achievementId: achievement._id }).lean() : null;
  console.log(JSON.stringify({ success: true, synthetic: true, mentor: mentor.email, stats, achievement, certificate }, null, 2));
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(JSON.stringify({ success: false, message: error.message }, null, 2));
  await mongoose.disconnect();
  process.exitCode = 1;
});
