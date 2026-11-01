'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { recommend } = require('../recommender/versions/v1');

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }

function kendall(left, right) {
  const positions = new Map(right.map((id, index) => [id, index]));
  const common = left.filter((id) => positions.has(id));
  if (common.length < 2) return 1;
  let concordant = 0; let discordant = 0;
  for (let i = 0; i < common.length; i += 1) for (let j = i + 1; j < common.length; j += 1) {
    if (positions.get(common[i]) < positions.get(common[j])) concordant += 1; else discordant += 1;
  }
  return (concordant - discordant) / (concordant + discordant || 1);
}

function run(snapshot, seed, weightProfile) {
  const now = snapshot.generatedAt;
  const rankings = {};
  const scores = [];
  let total = 0; let at100 = 0; let crossDepartment = 0; let explanationCount = 0; const clusterSizes = [];
  snapshot.users.forEach((seeker) => {
    const result = recommend({ seeker, candidates: snapshot.users, interactions: snapshot.interactions, mentorships: snapshot.mentorships, options: { seed, now, weightProfile } });
    const top = result.ranking.slice(0, 10);
    rankings[seeker.id] = top.map((entry) => ({ id: entry.id, score: entry.score, scoreRaw: entry.scoreRaw, components: entry.components, evidence: entry.evidence, meta: entry.meta }));
    top.forEach((entry) => {
      scores.push(entry.score); total += 1; if (entry.score === 100) at100 += 1;
      const candidate = snapshot.users.find((user) => user.id === entry.id);
      if (candidate && seeker.department && candidate.department && String(seeker.department).toUpperCase() !== String(candidate.department).toUpperCase()) crossDepartment += 1;
      if (entry.evidence && entry.evidence.explanation) explanationCount += 1;
    });
    (result.model.clusterInfo.clusters || []).forEach((cluster) => clusterSizes.push(cluster.size));
  });
  const tieCount = Object.values(rankings).reduce((sum, entries) => sum + (new Set(entries.map((entry) => entry.score)).size < entries.length ? 1 : 0), 0);
  return { seed, weightProfile, rankings, stats: {
    score: { count: scores.length, min: scores.length ? Math.min(...scores) : 0, max: scores.length ? Math.max(...scores) : 0, mean: scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0 },
    at100Percent: total ? (at100 / total) * 100 : 0,
    tieRate: Object.keys(rankings).length ? (tieCount / Object.keys(rankings).length) * 100 : 0,
    crossDepartmentTop10Percent: total ? (crossDepartment / total) * 100 : 0,
    clusterSizes,
    explanationFieldsPresentPercent: total ? (explanationCount / total) * 100 : 0,
  } };
}

function main() {
  const version = argument('--version', 'v1');
  const dataName = argument('--data', 'd1');
  const requestedSeed = argument('--seed', null);
  if (version !== 'v1') throw new Error(`Unsupported version: ${version}`);
  if (dataName !== 'd1') throw new Error(`Unsupported dataset: ${dataName}`);
  const input = path.join(__dirname, 'data', 'd1_snapshot.json');
  const outputDir = path.join(__dirname, 'out');
  const snapshot = JSON.parse(fs.readFileSync(input, 'utf8'));
  fs.mkdirSync(outputDir, { recursive: true });
  const seeds = requestedSeed === null ? [11, 23, 37, 41, 59] : [Number(requestedSeed)];
  const runs = seeds.map((seed) => run(snapshot, seed, 'internal'));
  runs.forEach((result) => fs.writeFileSync(path.join(outputDir, `v1-${result.seed}.json`), `${JSON.stringify({ version, data: dataName, ...result }, null, 2)}\n`));
  const repeated = run(snapshot, seeds[0], 'internal');
  const reproducible = hash(runs[0].rankings) === hash(repeated.rankings);
  const seekerIds = Object.keys(runs[0].rankings);
  const taus = [];
  for (let left = 0; left < runs.length; left += 1) for (let right = left + 1; right < runs.length; right += 1) {
    seekerIds.forEach((id) => taus.push(kendall(runs[left].rankings[id].map((entry) => entry.id), runs[right].rankings[id].map((entry) => entry.id))));
  }
  const stability = taus.length ? taus.reduce((sum, value) => sum + value, 0) / taus.length : 1;
  console.log(JSON.stringify({ version, data: dataName, seeds, reproducibleSameSeed: reproducible, averageKendallTau: stability, runs: runs.map(({ seed, stats }) => ({ seed, stats })) }));
}

try { main(); } catch (error) { console.error(`V1 runner failed: ${error.message}`); process.exitCode = 1; }
