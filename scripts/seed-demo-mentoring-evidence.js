require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const DemoMentoringEvidence = require('../models/DemoMentoringEvidence');
const connectDB = require('../config/database');

async function seed() {
  await connectDB();
  const mentors = await User.find({
    email: /^mentorlink\.demo(3[2-9]|[4-5]\d|60)@spit\.ac\.in$/,
    isActive: true,
    mentorshipIntent: { $in: ['offering', 'both'] },
  }).select('_id name email').lean();

  const operations = mentors.map((mentor, index) => ({
    updateOne: {
      filter: { mentorId: mentor._id },
      update: {
        $set: {
          totalInteractions: 70 + (index % 6) * 5,
          avgSatisfaction: 4.7 + (index % 3) * 0.1,
          subjectBreadth: 5 + (index % 4),
          acceptedMentorships: 18 + (index % 5),
          completionRate: 0.92 + (index % 3) * 0.02,
          recencyScore: 0.9 + (index % 2) * 0.05,
          achievementLevel: 4 + (index % 2),
          achievementInteractions: 70 + (index % 6) * 5,
          achievementMentees: 18 + (index % 5),
          achievementRating: 4.7 + (index % 3) * 0.1,
          demoOnly: true,
        },
      },
      upsert: true,
    },
  }));
  if (operations.length) await DemoMentoringEvidence.bulkWrite(operations);
  console.log(JSON.stringify({
    demoEvidenceRecords: operations.length,
    collection: 'demomentoringevidences',
    verifiedCollectionsModified: false,
  }, null, 2));
  await mongoose.disconnect();
}

seed().catch(async (error) => {
  console.error('Demo mentoring evidence seeding failed:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
