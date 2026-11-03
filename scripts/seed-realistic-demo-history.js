/**
 * Generate realistic, clearly labelled DEMO mentoring history.
 *
 * Writes only to the `demomentoringevidences` collection (demoOnly: true).
 * Real interactions, mentorships, achievements and certificates are never touched.
 * The engine reads these records only when DEMO_RECOMMENDATIONS=true.
 *
 * Each mentor's history is simulated session by session, then summarised:
 * - Participation is long-tailed: most mentors have few sessions, a few have many.
 * - Each mentor has a hidden quality that drives ratings and outcomes, plus noise.
 * - Only some mentees leave a rating, and ratings follow the J-shaped pattern seen
 *   in online reviews (mostly 4-5 stars, a few 1-star, little in between).
 * - Mentees often return, so unique mentees < sessions.
 * - Activity bunches around exam months, and some mentors have gone quiet.
 *
 * Usage:
 *   node scripts/seed-realistic-demo-history.js --dry-run
 *   node scripts/seed-realistic-demo-history.js --seed 20261102 --sample 40 \
 *     --include <userId,userId> --sessions-out path/to/sessions.json
 *   node scripts/seed-realistic-demo-history.js --remove   (deletes this generator's records)
 */
require('dotenv').config();
const fs = require('fs');
const mongoose = require('mongoose');
const User = require('../models/User');
const DemoMentoringEvidence = require('../models/DemoMentoringEvidence');
const connectDB = require('../config/database');

const GENERATOR = 'realistic-demo-history-v1';

// Same thresholds the engine uses: [sessions, unique mentees, resolved outcomes].
const ACHIEVEMENT_REQUIREMENTS = [[3, 2, 1], [8, 3, 3], [15, 5, 6], [30, 8, 12], [50, 12, 20]];
const MIN_RATING_FOR_ACHIEVEMENT = 4.0;

// Rough academic-calendar weighting (Indian semesters): more help-seeking before exams.
const MONTH_WEIGHT = { 0: 0.9, 1: 1.0, 2: 1.2, 3: 1.5, 4: 1.4, 5: 0.5, 6: 0.6, 7: 0.9, 8: 1.1, 9: 1.3, 10: 1.6, 11: 1.0 };

const SUBJECT_KEYWORDS = [
  ['Web Development', ['web', 'frontend', 'react', 'javascript', 'html', 'css', 'node', 'backend']],
  ['Machine Learning', ['machine learning', 'ml', 'python', 'data', 'ai', 'deep learning']],
  ['Mobile Development', ['android', 'mobile', 'flutter', 'kotlin', 'ios']],
  ['Cybersecurity', ['security', 'cyber', 'network security']],
  ['DevOps', ['devops', 'docker', 'cloud', 'aws', 'kubernetes']],
  ['Algorithms', ['dsa', 'algorithms', 'competitive', 'c++', 'java']],
  ['Computer Networks', ['networks', 'networking']],
];

function args() {
  const out = { seed: 20261102, sample: 40, include: [], dryRun: false, remove: false, sessionsOut: null };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--seed') out.seed = Number(argv[++i]);
    else if (a === '--sample') out.sample = Number(argv[++i]);
    else if (a === '--include') out.include = argv[++i].split(',').filter(Boolean);
    else if (a === '--sessions-out') out.sessionsOut = argv[++i];
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--remove') out.remove = true;
  }
  return out;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeRandom(seed) {
  const uniform = mulberry32(seed);
  const normal = () => {
    const u = Math.max(uniform(), 1e-12);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * uniform());
  };
  const gamma = (shape) => {
    if (shape < 1) return gamma(shape + 1) * uniform() ** (1 / shape);
    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    for (;;) {
      const x = normal();
      const v = (1 + c * x) ** 3;
      if (v > 0 && Math.log(uniform()) < 0.5 * x * x + d - d * v + Math.log(v)) return d * v;
    }
  };
  const beta = (a, b) => { const x = gamma(a); return x / (x + gamma(b)); };
  const pick = (weights) => {
    const total = weights.reduce((s, w) => s + w, 0);
    let r = uniform() * total;
    for (let i = 0; i < weights.length; i += 1) { r -= weights[i]; if (r <= 0) return i; }
    return weights.length - 1;
  };
  const shuffle = (list) => {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(uniform() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };
  return { uniform, normal, beta, pick, shuffle };
}

function mentorSubjects(user) {
  const terms = [...(user.skills || []), ...(user.interests || [])].map((t) => String(t).toLowerCase());
  const subjects = SUBJECT_KEYWORDS
    .filter(([, keys]) => keys.some((k) => terms.some((t) => t.includes(k))))
    .map(([name]) => name);
  return subjects.length ? subjects : ['Other'];
}

function sessionDate(rnd, start, end) {
  // Rejection-sample a day inside the window, weighted by academic month.
  for (let tries = 0; tries < 50; tries += 1) {
    const t = start + rnd.uniform() * (end - start);
    if (rnd.uniform() * 1.6 < MONTH_WEIGHT[new Date(t).getMonth()]) return t;
  }
  return start + rnd.uniform() * (end - start);
}

function simulateMentor(user, rnd, now) {
  const DAY = 86400000;
  const quality = rnd.beta(6, 2); // most mentors are decent, some are not
  const ratingPropensity = rnd.beta(2.5, 3); // share of mentees who bother to rate
  const returnTendency = 1 + rnd.uniform() * 4; // lower = more repeat mentees

  // Long-tailed participation, with some mentors barely active.
  let count = Math.round(Math.exp(1.6 + 0.95 * rnd.normal()));
  if (rnd.uniform() < 0.15) count = Math.floor(rnd.uniform() * 3);
  count = Math.max(0, Math.min(count, 70));

  const firstActive = now - (30 + rnd.uniform() * 270) * DAY;
  const wentQuiet = rnd.uniform() < 0.25;
  const lastActive = wentQuiet ? now - (45 + rnd.uniform() * 120) * DAY : now - rnd.uniform() * 10 * DAY;
  const windowEnd = Math.max(lastActive, firstActive + 7 * DAY);

  const subjects = mentorSubjects(user);
  const menteeCounts = [];
  const sessions = [];
  for (let i = 0; i < count; i += 1) {
    // Returning mentee vs new mentee (Chinese restaurant process).
    let mentee;
    if (!menteeCounts.length || rnd.uniform() < returnTendency / (returnTendency + menteeCounts.length)) {
      mentee = menteeCounts.length;
      menteeCounts.push(0);
    } else {
      mentee = rnd.pick(menteeCounts);
    }
    menteeCounts[mentee] += 1;

    const repeat = menteeCounts[mentee] > 1;
    const sessionQuality = Math.min(1, Math.max(0, quality + 0.12 * rnd.normal()));
    let rating = null;
    if (rnd.uniform() < ratingPropensity * (repeat ? 0.75 : 1)) {
      // J-shaped: extremes over-represented because people with strong views rate more.
      const w1 = 0.02 + 0.10 * (1 - sessionQuality);
      const w2 = 0.01 + 0.05 * (1 - sessionQuality);
      const w3 = 0.03 + 0.10 * (1 - sessionQuality);
      const w4 = 0.12 + 0.25 * (1 - Math.abs(sessionQuality - 0.6));
      const w5 = 0.15 + 0.85 * sessionQuality ** 2;
      rating = 1 + rnd.pick([w1, w2, w3, w4, w5]);
    }
    const subjectTag = rnd.uniform() < 0.12 ? 'Other' : subjects[Math.floor(rnd.uniform() * subjects.length)];
    sessions.push({
      menteeIndex: mentee,
      timestamp: new Date(sessionDate(rnd, firstActive, windowEnd)).toISOString(),
      subjectTag,
      satisfactionRating: rating,
      outcomeStatus: rnd.uniform() < 0.25 + 0.5 * sessionQuality ? 'resolved' : 'unresolved',
      followUpCompleted: rnd.uniform() < 0.2 + 0.35 * sessionQuality,
    });
  }
  sessions.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return { quality, sessions, menteeCount: menteeCounts.length };
}

function summarise(sim) {
  const { sessions, menteeCount } = sim;
  const ratings = sessions.map((s) => s.satisfactionRating).filter((r) => r);
  const resolved = sessions.filter((s) => s.outcomeStatus === 'resolved').length;
  const completed = sessions.filter((s) => s.outcomeStatus === 'resolved' || s.followUpCompleted).length;
  const avg = ratings.length ? ratings.reduce((s, r) => s + r, 0) / ratings.length : 0;

  let level = 0;
  ACHIEVEMENT_REQUIREMENTS.forEach(([n, m, r], i) => {
    if (sessions.length >= n && menteeCount >= m && resolved >= r && avg >= MIN_RATING_FOR_ACHIEVEMENT) level = i + 1;
  });
  const lastAt = sessions.length ? new Date(sessions[sessions.length - 1].timestamp) : null;
  return {
    totalInteractions: sessions.length,
    avgSatisfaction: Number(avg.toFixed(2)),
    ratingCount: ratings.length,
    subjectBreadth: new Set(sessions.map((s) => s.subjectTag)).size,
    uniqueMentees: menteeCount,
    resolvedInteractions: resolved,
    verifiedCompletedSessions: completed,
    // A mentorship per mentee; some have since ended.
    acceptedMentorships: sessions.length ? Math.max(1, Math.round(menteeCount * (0.55 + 0.4 * sim.quality))) : 0,
    completionRate: sessions.length ? Number((completed / sessions.length).toFixed(3)) : 0,
    lastInteractionAt: lastAt,
    achievementLevel: level,
    achievementInteractions: sessions.length,
    achievementMentees: menteeCount,
    achievementRating: Number(avg.toFixed(2)),
  };
}

async function run() {
  const opts = args();
  await connectDB();

  if (opts.remove) {
    const result = await DemoMentoringEvidence.deleteMany({ generator: new RegExp(`^${GENERATOR}`) });
    console.log(JSON.stringify({ removed: result.deletedCount, generator: GENERATOR }, null, 2));
    return;
  }

  const rnd = makeRandom(opts.seed);
  const now = Date.now();
  // Never overwrite demo records made by other scripts.
  const otherDemo = await DemoMentoringEvidence.find({ generator: { $not: new RegExp(`^${GENERATOR}`) } }).select('mentorId').lean();
  const skip = new Set(otherDemo.map((d) => String(d.mentorId)));

  const pool = (await User.find({ isActive: true, mentorshipIntent: { $in: ['offering', 'both'] } })
    .select('_id name skills interests').lean())
    .filter((u) => !skip.has(String(u._id)));
  const included = pool.filter((u) => opts.include.includes(String(u._id)));
  const sampled = rnd.shuffle(pool.filter((u) => !opts.include.includes(String(u._id)))).slice(0, opts.sample);
  const chosen = [...included, ...sampled];

  const sessionLog = [];
  const records = chosen.map((user) => {
    const sim = simulateMentor(user, rnd, now);
    sessionLog.push({ mentorId: String(user._id), name: user.name, hiddenQuality: Number(sim.quality.toFixed(3)), sessions: sim.sessions });
    return { user, summary: summarise(sim) };
  });

  const counts = records.map((r) => r.summary.totalInteractions).sort((a, b) => a - b);
  const allRatings = sessionLog.flatMap((m) => m.sessions.map((s) => s.satisfactionRating).filter(Boolean));
  const ratingDist = [1, 2, 3, 4, 5].map((v) => allRatings.filter((r) => r === v).length);
  console.log(JSON.stringify({
    generator: GENERATOR,
    seed: opts.seed,
    mentors: records.length,
    sessionsTotal: counts.reduce((s, c) => s + c, 0),
    sessionsPerMentor: { min: counts[0], median: counts[Math.floor(counts.length / 2)], max: counts[counts.length - 1] },
    ratingDistribution1to5: ratingDist,
    shareRated: Number((allRatings.length / Math.max(1, counts.reduce((s, c) => s + c, 0))).toFixed(2)),
    achievementLevels: records.reduce((acc, r) => { acc[r.summary.achievementLevel] = (acc[r.summary.achievementLevel] || 0) + 1; return acc; }, {}),
    examples: records.slice(0, 6).map((r) => ({ name: r.user.name, ...r.summary, lastInteractionAt: r.summary.lastInteractionAt?.toISOString().slice(0, 10) })),
    dryRun: opts.dryRun,
  }, null, 2));

  if (opts.sessionsOut) fs.writeFileSync(opts.sessionsOut, JSON.stringify({ generator: GENERATOR, seed: opts.seed, mentors: sessionLog }, null, 2));
  if (opts.dryRun) return;

  await DemoMentoringEvidence.bulkWrite(records.map(({ user, summary }) => ({
    updateOne: {
      filter: { mentorId: user._id },
      update: { $set: { ...summary, generator: `${GENERATOR} seed=${opts.seed}`, demoOnly: true } },
      upsert: true,
    },
  })));
  console.log(`Wrote ${records.length} demo records. Real interaction data was not modified.`);
}

run()
  .catch((error) => { console.error('Demo history generation failed:', error.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect().catch(() => {}));
