const ContributionEvent = require('../models/ContributionEvent');
const Interaction = require('../models/Interaction');
const Achievement = require('../models/Achievement');
const Certificate = require('../models/Certificate');
const User = require('../models/User');
const sendEmail = require('./sendEmail');

const ACHIEVEMENTS = [
  { level: 1, threshold: 50, title: 'Helpful Contributor', minInteractions: 3, minMentees: 2, minResolved: 1, minRating: 4 },
  { level: 2, threshold: 150, title: 'Peer Mentor', minInteractions: 8, minMentees: 3, minResolved: 3, minRating: 4 },
  { level: 3, threshold: 300, title: 'Trusted Mentor', minInteractions: 15, minMentees: 5, minResolved: 6, minRating: 4 },
  { level: 4, threshold: 600, title: 'Mentor Champion', minInteractions: 30, minMentees: 8, minResolved: 12, minRating: 4 },
  { level: 5, threshold: 1000, title: 'Mentor Excellence Award', minInteractions: 50, minMentees: 12, minResolved: 20, minRating: 4 },
];

function achievementFor(stats) {
  return ACHIEVEMENTS
    .filter((achievement) => stats.points >= achievement.threshold
      && stats.confirmedInteractions >= achievement.minInteractions
      && stats.uniqueMentees >= achievement.minMentees
      && stats.resolvedInteractions >= achievement.minResolved
      && (stats.averageRating || 0) >= achievement.minRating)
    .at(-1) || null;
}

async function getContributionStats(mentorId) {
  const [pointTotals, confirmedInteractions, mentees, feedback, outcomeTotals] = await Promise.all([
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
    Interaction.aggregate([
      { $match: { mentorId, confirmationStatus: 'confirmed' } },
      { $group: {
        _id: null,
        resolvedInteractions: { $sum: { $cond: [{ $eq: ['$outcomeStatus', 'resolved'] }, 1, 0] } },
        recommendedCount: { $sum: { $cond: [{ $eq: ['$menteeWouldRecommend', true] }, 1, 0] } },
        recommendationResponses: { $sum: { $cond: [{ $ne: ['$menteeWouldRecommend', null] }, 1, 0] } },
        followUpsCompleted: { $sum: { $cond: ['$followUpCompleted', 1, 0] } },
      } },
    ]),
  ]);

  const outcomeStats = outcomeTotals[0] || {};
  const recommendationRate = outcomeStats.recommendationResponses
    ? outcomeStats.recommendedCount / outcomeStats.recommendationResponses : null;

  return {
    points: pointTotals[0]?.points || 0,
    confirmedInteractions,
    uniqueMentees: mentees.length,
    averageRating: feedback[0]?.average || null,
    resolvedInteractions: outcomeStats.resolvedInteractions || 0,
    followUpsCompleted: outcomeStats.followUpsCompleted || 0,
    recommendationRate,
  };
}

async function awardForConfirmedInteraction(interactionId) {
  const interaction = await Interaction.findById(interactionId).lean();
  if (!interaction || interaction.confirmationStatus !== 'confirmed') return null;

  const previousMenteeInteractions = await Interaction.countDocuments({
    mentorId: interaction.mentorId,
    menteeId: interaction.menteeId,
    confirmationStatus: 'confirmed',
    _id: { $ne: interaction._id },
  });
  const ratingPoints = { 1: 0, 2: 1, 3: 4, 4: 7, 5: 10 };
  const activityPoints = Math.min(10, 6 + Math.min(4, Math.floor(Number(interaction.duration || 0) / 30) * 2));
  const events = [
    { eventType: 'VERIFIED_ACTIVITY', points: activityPoints },
  ];
  if (interaction.satisfactionRating) events.push({ eventType: 'QUALITY_FEEDBACK', points: ratingPoints[interaction.satisfactionRating] || 0 });
  if (interaction.outcomeStatus === 'resolved') events.push({ eventType: 'RESOLVED_OUTCOME', points: 10 });
  if (interaction.followUpCompleted) events.push({ eventType: 'FOLLOW_UP_COMPLETED', points: 5 });
  if (previousMenteeInteractions === 0) events.push({ eventType: 'UNIQUE_MENTEE', points: 5 });

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
  const achievement = achievementFor(stats);
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

  const mentor = await User.findById(interaction.mentorId).select('name email').lean();
  let certificate = await Certificate.findOne({ achievementId: savedAchievement._id });
  if (!certificate) {
    certificate = await Certificate.create({
      certificateId: `ML-${new Date().getFullYear()}-${String(savedAchievement._id).slice(-8).toUpperCase()}`,
      mentorId: interaction.mentorId,
      achievementId: savedAchievement._id,
      title: achievement.title,
      pointsAtIssuance: stats.points,
      confirmedInteractions: stats.confirmedInteractions,
      uniqueMentees: stats.uniqueMentees,
      averageRating: stats.averageRating,
    });

    if (mentor?.email) {
      const certificateMarkup = `<!doctype html><html><body style="font-family:Georgia,serif;text-align:center;padding:48px;color:#17324d"><h1>MentorLink Certificate of Achievement</h1><p>This certificate is presented to</p><h2>${mentor.name || 'Mentor'}</h2><h2>${achievement.title}</h2><p>${stats.points} verified contribution points<br>${stats.confirmedInteractions} confirmed mentoring sessions<br>${stats.uniqueMentees} mentees helped</p><p>Certificate ID: ${certificate.certificateId}</p></body></html>`;
      await sendEmail({
        to: mentor.email,
        subject: `MentorLink achievement earned: ${achievement.title}`,
        html: `<h2>Congratulations, ${mentor.name || 'Mentor'}!</h2><p>Your verified mentoring contributions have earned the <strong>${achievement.title}</strong> achievement.</p><ul><li>${stats.points} contribution points</li><li>${stats.confirmedInteractions} confirmed sessions</li><li>${stats.uniqueMentees} mentees helped</li></ul><p>Your certificate ID is <strong>${certificate.certificateId}</strong>. You can view it in your MentorLink profile.</p>`,
        attachments: [{
          filename: `${certificate.certificateId}.html`,
          content: certificateMarkup,
          contentType: 'text/html',
        }],
      });
    }
  }

  return stats;
}

module.exports = {
  ACHIEVEMENTS,
  getContributionStats,
  awardForConfirmedInteraction,
};
