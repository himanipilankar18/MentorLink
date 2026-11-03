/**
 * Measure how recommendations perform in real use, per engine version.
 *
 * Reads the RecommendationLog collection (what was shown, at which rank, and what users did next)
 * and the confirmed sessions that followed. Read-only.
 *
 * Usage: node scripts/recommendation-metrics.js [--since 2026-11-01] [--json out.json]
 */
require('dotenv').config();
const fs = require('fs');
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const RecommendationLog = require('../models/RecommendationLog');
const Interaction = require('../models/Interaction');

function option(name) {
  const index = process.argv.indexOf(name);
  return index > -1 ? process.argv[index + 1] : null;
}

const ratio = (part, whole) => (whole ? Number((part / whole).toFixed(4)) : null);
const mean = (values) => (values.length ? Number((values.reduce((s, v) => s + v, 0) / values.length).toFixed(3)) : null);

async function run() {
  await connectDB();
  const since = option('--since') ? new Date(option('--since')) : new Date(0);
  const logs = await RecommendationLog.find({ createdAt: { $gte: since } }).lean();

  // Ratings of confirmed sessions, keyed by mentee+mentor, to judge accepted matches.
  const sessions = await Interaction.find({ confirmationStatus: 'confirmed', confirmedAt: { $gte: since } })
    .select('mentorId menteeId satisfactionRating outcomeStatus menteeWouldRecommend').lean();
  const sessionsByPair = new Map();
  sessions.forEach((s) => {
    const key = `${s.menteeId}:${s.mentorId}`;
    if (!sessionsByPair.has(key)) sessionsByPair.set(key, []);
    sessionsByPair.get(key).push(s);
  });

  const groups = new Map();
  logs.forEach((log) => {
    const key = `${log.engine}/${log.engineVersion}${log.demoEvidence ? ' (demo history on)' : ''}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(log);
  });

  const report = [...groups.entries()].map(([version, group]) => {
    const impressions = group.reduce((s, log) => s + log.items.length, 0);
    const events = group.flatMap((log) => log.events.map((e) => ({ ...e, seekerId: log.seekerId })));
    const byType = (type) => events.filter((e) => e.type === type);
    const requested = byType('requested');
    const accepted = byType('accepted');
    const listsWithRequestAt = (k) => group.filter((log) => log.events.some((e) => e.type === 'requested' && e.rank && e.rank <= k)).length;

    // Reciprocal rank of the first requested mentor in each list (0 when nothing was requested).
    const reciprocalRanks = group.map((log) => {
      const ranks = log.events.filter((e) => e.type === 'requested' && e.rank).map((e) => e.rank);
      return ranks.length ? 1 / Math.min(...ranks) : 0;
    });

    const matchSessions = accepted.flatMap((e) => sessionsByPair.get(`${e.seekerId}:${e.mentorId}`) || []);
    const ratings = matchSessions.map((s) => s.satisfactionRating).filter(Boolean);

    return {
      version,
      listsShown: group.length,
      uniqueUsers: new Set(group.map((log) => String(log.seekerId))).size,
      mentorsShown: impressions,
      detailViewRate: ratio(byType('viewed_details').length, impressions),
      profileOpenRate: ratio(byType('opened_profile').length, impressions),
      requestRateAt5: ratio(listsWithRequestAt(5), group.length),
      requestRateAt10: ratio(listsWithRequestAt(10), group.length),
      meanReciprocalRank: mean(reciprocalRanks),
      meanRankOfRequested: mean(requested.map((e) => e.rank).filter(Boolean)),
      acceptanceRate: ratio(accepted.length, accepted.length + byType('rejected').length),
      helpfulShare: ratio(byType('helpful').length, byType('helpful').length + byType('not_helpful').length),
      acceptedMatches: {
        confirmedSessions: matchSessions.length,
        averageRating: mean(ratings),
        resolvedShare: ratio(matchSessions.filter((s) => s.outcomeStatus === 'resolved').length, matchSessions.length),
      },
    };
  });

  const output = { since: since.toISOString(), versions: report };
  console.log(JSON.stringify(output, null, 2));
  if (option('--json')) fs.writeFileSync(option('--json'), JSON.stringify(output, null, 2));
}

run()
  .catch((error) => { console.error('Metrics failed:', error.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect().catch(() => {}));
