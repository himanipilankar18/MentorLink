require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const User = require('../models/User');
const Interaction = require('../models/Interaction');
const Mentorship = require('../models/Mentorship');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  const [interactions, mentorships] = await Promise.all([
    Interaction.find({ confirmationStatus: 'confirmed' })
      .select('mentorId menteeId subjectTag satisfactionRating timestamp confirmationStatus')
      .lean(),
    Mentorship.find({ status: { $in: ['accepted', 'terminated'] } })
      .select('mentorId menteeId status')
      .lean(),
  ]);

  const relevantBySeeker = new Map();
  const addRelevant = (menteeId, mentorId) => {
    const seeker = String(menteeId);
    const mentor = String(mentorId);
    if (!relevantBySeeker.has(seeker)) relevantBySeeker.set(seeker, new Set());
    relevantBySeeker.get(seeker).add(mentor);
  };
  interactions.forEach((row) => addRelevant(row.menteeId, row.mentorId));
  mentorships.forEach((row) => addRelevant(row.menteeId, row.mentorId));

  const seekerIds = [...relevantBySeeker.keys()];
  const seekers = await User.find({ _id: { $in: seekerIds }, isActive: true }).select('-password').lean();
  const mentorIds = [...new Set([...relevantBySeeker.values()].flatMap((ids) => [...ids]))];
  const candidates = await User.find({ _id: { $in: mentorIds }, isActive: true }).select('-password').lean();
  const candidateById = new Map(candidates.map((candidate) => [String(candidate._id), candidate]));

  let observedOutcomePairs = 0;
  let eligibleOutcomePairs = 0;
  const populations = seekers.flatMap((seeker) => {
    const relevant = [...(relevantBySeeker.get(String(seeker._id)) || [])]
    observedOutcomePairs += relevant.length;
    const eligibleRelevant = relevant
      .filter((id) => {
        const candidate = candidateById.get(id);
        if (!candidate) return false;
        const role = String(candidate.role || '').toLowerCase();
        return role === 'faculty'
          || role === 'admin'
          || Number(candidate.year) > Number(seeker.year);
      });
    eligibleOutcomePairs += eligibleRelevant.length;
    const relevantForEvaluation = eligibleRelevant;
    if (!relevantForEvaluation.length) return [];
    const populationCandidates = candidates.filter((candidate) => (
      String(candidate._id) !== String(seeker._id)
      && String(candidate.mentorshipIntent || '').toLowerCase() !== 'seeking'
      && (
        ['faculty', 'admin'].includes(String(candidate.role || '').toLowerCase())
        || Number(candidate.year) > Number(seeker.year)
      )
    ));
    if (!populationCandidates.length) return [];
    return [{
      seekers: [seeker],
      candidates: populationCandidates,
      interactions: interactions.filter((row) => populationCandidates.some((candidate) => String(candidate._id) === String(row.mentorId))),
      mentorships: mentorships.filter((row) => populationCandidates.some((candidate) => String(candidate._id) === String(row.mentorId))),
      weightProfile: 'internal',
      now: new Date().toISOString(),
      relevantBySeeker: { [String(seeker._id)]: relevantForEvaluation },
    }];
  });

  const output = {
    datasetType: 'observed-outcomes',
    warning: 'Labels come only from observed confirmed interactions and accepted/terminated mentorships; this is a small outcome-based benchmark, not a population-wide accuracy estimate.',
    evidence: {
      confirmedInteractions: interactions.length,
      acceptedOrTerminatedMentorships: mentorships.length,
      observedOutcomePairs,
      eligibleOutcomePairs,
      excludedByCurrentEligibility: observedOutcomePairs - eligibleOutcomePairs,
      seekers: populations.length,
    },
    populations,
  };
  const outputPath = path.join(__dirname, '..', 'research', 'data', 'observed-mentorlink-evaluation.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(JSON.stringify({ outputPath, evidence: output.evidence, populations: populations.length }, null, 2));
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('Observed evaluation export failed:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
