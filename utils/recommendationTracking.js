const RecommendationLog = require('../models/RecommendationLog');

// How long after seeing a recommendation a request still counts as coming from it.
const ATTRIBUTION_WINDOW_DAYS = 30;

async function logRecommendationImpression({ seekerId, recommendations, engine, engineVersion, demoEvidence, candidateCount }) {
  const items = (recommendations || [])
    .map((rec, index) => ({
      mentorId: rec?.mentor?._id || rec?.mentor?.id || rec?._id || rec?.id,
      rank: index + 1,
      score: Number(rec?.matchScore ?? rec?.score ?? null),
    }))
    .filter((item) => item.mentorId);
  if (!seekerId || !items.length) return null;

  const log = await RecommendationLog.create({
    seekerId,
    engine,
    engineVersion,
    demoEvidence: Boolean(demoEvidence),
    candidateCount: Number(candidateCount) || items.length,
    items,
  });
  return log._id;
}

// Attach an event to the list that showed this mentor to this seeker.
// Uses logId when the client sent one; otherwise the most recent list within the window.
async function recordRecommendationEvent({ seekerId, mentorId, type, logId = null }) {
  if (!seekerId || !mentorId || !RecommendationLog.EVENT_TYPES.includes(type)) return false;

  const since = new Date(Date.now() - ATTRIBUTION_WINDOW_DAYS * 86400000);
  const filter = { seekerId, 'items.mentorId': mentorId };
  if (logId) filter._id = logId;
  else filter.createdAt = { $gte: since };

  const log = await RecommendationLog.findOne(filter).sort({ createdAt: -1 }).select('_id items');
  if (!log) return false;

  const item = log.items.find((entry) => String(entry.mentorId) === String(mentorId));
  await RecommendationLog.updateOne(
    { _id: log._id },
    { $push: { events: { mentorId, type, rank: item ? item.rank : null, at: new Date() } } },
  );
  return true;
}

// Tracking must never break the request that triggered it.
function trackSafely(promise) {
  return Promise.resolve(promise).catch((error) => {
    console.warn('[recommendation-tracking]', error.message);
    return null;
  });
}

module.exports = {
  ATTRIBUTION_WINDOW_DAYS,
  logRecommendationImpression,
  recordRecommendationEvent,
  trackSafely,
};
