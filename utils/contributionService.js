const ContributionEvent = require('../models/ContributionEvent');
const Interaction = require('../models/Interaction');
const Achievement = require('../models/Achievement');
const Certificate = require('../models/Certificate');
const User = require('../models/User');
const sendEmail = require('./sendEmail');

function buildCertificateEmailMarkup({ mentorName, achievementTitle, certificateId, points, sessions, mentees, rating }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>body{margin:0;padding:32px;background:#eef1f4;color:#172a3a;font-family:Arial,sans-serif}.certificate{max-width:760px;margin:auto;padding:58px;text-align:center;background:#fffdf8;border:2px solid #b77a32;box-shadow:0 12px 30px rgba(23,42,58,.16)}.certificate-inner{border:1px solid rgba(183,122,50,.55);padding:42px}.brand{letter-spacing:.28em;color:#b77a32;font-weight:700;font-size:13px}.kicker{margin:34px 0 10px;color:#647484;text-transform:uppercase;letter-spacing:.18em;font-size:11px}.title{font:400 42px Georgia,serif;margin:10px 0 28px}.recipient{font:400 32px Georgia,serif;color:#b77a32;margin:20px}.achievement{font:22px Georgia,serif}.evidence{margin:30px 0;padding:16px;border-top:1px solid #b77a32;border-bottom:1px solid #b77a32;line-height:1.8}.id{color:#647484;font-size:11px}</style></head><body><main class="certificate"><div class="certificate-inner"><div class="brand">MENTORLINK</div><div class="kicker">Certificate of mentoring achievement</div><h1 class="title">Certificate of Recognition</h1><p>This certificate is proudly presented to</p><div class="recipient">${mentorName}</div><p class="achievement">for earning the <strong>${achievementTitle}</strong> distinction</p><div class="evidence">${points} verified points · ${sessions} confirmed sessions · ${mentees} mentees helped · ${rating ? `${Number(rating).toFixed(1)}/5 average rating` : 'rating pending'}</div><p class="id">Certificate ID: ${certificateId}</p></div></main></body></html>`;
}

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
      const certificateMarkup = buildCertificateEmailMarkup({
        mentorName: mentor.name || 'Mentor',
        achievementTitle: achievement.title,
        certificateId: certificate.certificateId,
        points: stats.points,
        sessions: stats.confirmedInteractions,
        mentees: stats.uniqueMentees,
        rating: stats.averageRating,
      });
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
