require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const User = require('../models/User');
const Mentorship = require('../models/Mentorship');
const Interaction = require('../models/Interaction');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  const [users, mentorships, interactions] = await Promise.all([
    User.find({}).select('-password').lean(),
    Mentorship.find({}).select('mentorId menteeId status requestedAt acceptedAt terminatedAt').lean(),
    Interaction.find({}).select('mentorId menteeId subjectTag satisfactionRating outcomeStatus confirmationStatus timestamp').lean(),
  ]);
  const output = {
    datasetId: 'DS1',
    datasetType: 'production-snapshot',
    capturedAt: new Date().toISOString(),
    warning: 'Read-only snapshot of the existing MongoDB database. No production records were modified.',
    users,
    mentorships,
    interactions,
  };
  const outputPath = path.join(__dirname, '..', 'research', 'data', 'DS1-snapshot.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(JSON.stringify({
    outputPath,
    users: users.length,
    mentorships: mentorships.length,
    interactions: interactions.length,
    confirmedInteractions: interactions.filter((row) => row.confirmationStatus === 'confirmed').length,
  }, null, 2));
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('DS1 export failed:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
