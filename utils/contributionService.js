const ContributionEvent = require('../models/ContributionEvent');
const Interaction = require('../models/Interaction');
const Achievement = require('../models/Achievement');
const Certificate = require('../models/Certificate');
const User = require('../models/User');

const ACHIEVEMENTS = [
  { level: 1, threshold: 50, title: 'Helpful Contributor', minInteractions: 3, minMentees: 2 },
  { level: 2, threshold: 150, title: 'Peer Mentor', minInteractions: 8, minMentees: 3 },
  { level: 3, threshold: 300, title: 'Trusted Mentor', minInteractions: 15, minMentees: 5 },
  { level: 4, threshold: 600, title: 'Mentor Champion', minInteractions: 30, minMentees: 8 },
  { level: 5, threshold: 1000, title: 'Mentor Excellence Award', minInteractions: 50, minMentees: 12 },
];

function achievementFor(points, interactions, uniqueMentees) {
  return ACHIEVEMENTS
    .filter((achievement) => points >= achievement.threshold
      && interactions >= achievement.minInteractions
      && uniqueMentees >= achievement.minMentees)
    .at(-1) || null;
}

async function getContributionStats(mentorId) {
  const [pointTotals, confirmedInteractions, mentees, averageRating] = await Promise.all([
    ContributionEvent.aggregate([
      { $match: { mentorId } },
      { $group: { _id: null, points: { $sum: '$points' } } },
    ]),
    Interaction.countDocuments({ mentorId, confirmationStatus: 'confirmed' }),
    Interaction.distinct('menteeId', { mentorId, confirmationStatus: 'confirmed' }),
    Interaction.aggregate([
      { $match: { mentorId, confirmationStatus: 'confirmed', satisfactionRating: { $ne: null } } },
      { $group: { _id: null, average: { $avg: '$satisfactionRating' } } },
    ]),
  ]);

  return {
    points: pointTotals[0]?.points || 0,
    confirmedInteractions,
    uniqueMentees: mentees.length,
    averageRating: averageRating[0]?.average || null,
  };
}

async function awardForConfirmedInteraction(interactionId) {
  const interaction = await Interaction.findById(interactionId).lean();
  if (!interaction || interaction.confirmationStatus !== 'confirmed') return null;

  const events = [
    { eventType: 'SESSION_CONFIRMED', points: 10 },
  ];
  if (interaction.duration >= 30) events.push({ eventType: 'LONG_SESSION', points: 3 });
  if (interaction.satisfactionRating >= 4) {
    events.push({ eventType: 'HIGH_SATISFACTION', points: interaction.satisfactionRating === 5 ? 5 : 3 });
  }

  for (const event of events) {
    await ContributionEvent.updateOne(
      { interactionId: interaction._id, eventType: event.eventType },
      {
        $setOnInsert: {
          mentorId: interaction.mentorId,
          menteeId: interaction.menteeId,
          mentorshipId: interaction.mentorshipId,
          interactionId: interaction._id,
          eventType: event.eventType,
          points: event.points,
          evidence: {
            duration: interaction.duration,
            satisfactionRating: interaction.satisfactionRating,
          },
        },
      },
      { upsert: true },
    );
  }

  const stats = await getContributionStats(interaction.mentorId);
  const achievement = achievementFor(stats.points, stats.confirmedInteractions, stats.uniqueMentees);
  if (!achievement) return stats;

  const savedAchievement = await Achievement.findOneAndUpdate(
    { mentorId: interaction.mentorId, level: achievement.level },
    {
      $setOnInsert: {
        mentorId: interaction.mentorId,
        level: achievement.level,
        title: achievement.title,
        pointsAtAward: stats.points,
        confirmedInteractions: stats.confirmedInteractions,
        uniqueMentees: stats.uniqueMentees,
        averageRating: stats.averageRating,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const mentor = await User.findById(interaction.mentorId).select('name').lean();
  await Certificate.findOneAndUpdate(
    { achievementId: savedAchievement._id },
    {
      $setOnInsert: {
        certificateId: `ML-${new Date().getFullYear()}-${String(savedAchievement._id).slice(-8).toUpperCase()}`,
        mentorId: interaction.mentorId,
        achievementId: savedAchievement._id,
        title: achievement.title,
        pointsAtIssuance: stats.points,
        confirmedInteractions: stats.confirmedInteractions,
        uniqueMentees: stats.uniqueMentees,
        averageRating: stats.averageRating,
        recipientName: mentor?.name,
      },
    },
    { upsert: true, setDefaultsOnInsert: true },
  );

  return stats;
}

module.exports = {
  ACHIEVEMENTS,
  getContributionStats,
  awardForConfirmedInteraction,
};
