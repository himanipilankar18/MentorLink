require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const User = require('../models/User');
const Mentorship = require('../models/Mentorship');
const Interaction = require('../models/Interaction');

const versions = ['v1', 'v2.0', 'v2.1', 'v2.2', 'v2.3', 'v2.4', 'v3', 'v4'];

function eligibilityReason(seeker, mentor) {
  if (!mentor) return 'mentor profile missing';
  if (mentor.isActive === false) return 'mentor inactive';
  if (!['offering', 'both'].includes(String(mentor.mentorshipIntent || '').toLowerCase())) return 'mentor is not offering mentorship';
  const role = String(mentor.role || '').toLowerCase();
  if (role === 'faculty' || role === 'admin') return null;
  if (!Number.isFinite(Number(seeker.year)) || !Number.isFinite(Number(mentor.year))) return 'missing academic year';
  if (Number(mentor.year) <= Number(seeker.year)) return 'mentor is not in a higher academic year';
  return null;
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  const [users, mentorships, interactions] = await Promise.all([
    User.find({}).select('name year role isActive mentorshipIntent').lean(),
    Mentorship.find({}).select('mentorId menteeId status').lean(),
    Interaction.find({}).select('mentorId menteeId confirmationStatus satisfactionRating outcomeStatus').lean(),
  ]);
  const byId = new Map(users.map((user) => [String(user._id), user]));
  const observed = mentorships.map((row) => {
    const seeker = byId.get(String(row.menteeId));
    const mentor = byId.get(String(row.mentorId));
    const reason = eligibilityReason(seeker, mentor);
    return {
      relationshipId: String(row._id),
      mentorId: String(row.mentorId),
      menteeId: String(row.menteeId),
      status: row.status,
      mentorName: mentor?.name || null,
      menteeName: seeker?.name || null,
      eligibleUnderCurrentRules: !reason,
      exclusionReason: reason,
    };
  });
  const confirmed = interactions.filter((row) => row.confirmationStatus === 'confirmed');
  const output = {
    datasetId: 'DS1',
    datasetType: 'observed-outcomes',
    totalUsers: users.length,
    totalObservedRelationships: observed.length,
    eligibleObservedRelationships: observed.filter((row) => row.eligibleUnderCurrentRules).length,
    excludedObservedRelationships: observed.filter((row) => !row.eligibleUnderCurrentRules).length,
    confirmedInteractions: confirmed.length,
    confirmedInteractionsWithRatings: confirmed.filter((row) => row.satisfactionRating != null).length,
    confirmedInteractionsWithOutcomes: confirmed.filter((row) => row.outcomeStatus != null).length,
    byVersion: Object.fromEntries(versions.map((version) => [version, {
      status: observed.some((row) => row.eligibleUnderCurrentRules) ? 'eligible labels available' : 'unavailable: no observed relationship satisfies current eligibility rules',
      eligibleObservedRelationships: observed.filter((row) => row.eligibleUnderCurrentRules).length,
    }])),
    relationships: observed,
  };
  const outputDir = path.join(__dirname, '..', 'research', 'out', 'DS1-observed');
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'observed-analysis.json'), JSON.stringify(output, null, 2));
  fs.writeFileSync(path.join(outputDir, 'observed-analysis.csv'), [
    'relationshipId,mentorName,menteeName,status,eligibleUnderCurrentRules,exclusionReason',
    ...observed.map((row) => [
      row.relationshipId, JSON.stringify(row.mentorName || ''), JSON.stringify(row.menteeName || ''),
      row.status, row.eligibleUnderCurrentRules, JSON.stringify(row.exclusionReason || ''),
    ].join(',')),
  ].join('\n'));
  console.log(JSON.stringify({
    totalUsers: output.totalUsers,
    totalObservedRelationships: output.totalObservedRelationships,
    eligibleObservedRelationships: output.eligibleObservedRelationships,
    excludedObservedRelationships: output.excludedObservedRelationships,
    confirmedInteractions: output.confirmedInteractions,
  }, null, 2));
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('Observed DS1 analysis failed:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
