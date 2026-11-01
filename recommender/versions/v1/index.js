'use strict';

// FROZEN V1. Do not edit. Changes go in v2.

const { mulberry32 } = require('../../common/prng');

const INTERNAL_WEIGHTS = Object.freeze({ skills: 0.20, interests: 0.12, availability: 0.08, goals: 0.18 });
const EXTERNAL_WEIGHTS = Object.freeze({ skills: 0.35, interests: 0.25, availability: 0.15, goals: 0.25 });

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

function array(value) {
  return Array.isArray(value) ? value.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean).filter((item, index, values) => values.indexOf(item) === index) : [];
}

function tokens(value) {
  if (value === null || value === undefined) return [];
  const normalized = String(value).toLowerCase().replace(/https?:\/\/\S+/gi, ' ').replace(/[_]+/g, ' ')
    .replace(/[^a-z0-9\s+.#/\-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return normalized ? normalized.split(/\s+/).map((token) => token.trim()).filter((token) => token && token.length > 1 && !/^[-.#+/]+$/.test(token)) : [];
}

function profileText(user) {
  const result = [];
  const add = (value) => {
    if (value === null || value === undefined) return;
    if (Array.isArray(value)) return value.forEach(add);
    if (typeof value === 'object') return Object.values(value).forEach(add);
    result.push(...tokens(String(value)));
  };
  if (!user || typeof user !== 'object') return '';
  add(user.skills); add(user.interests); add(user.bio);
  (user.projects || []).forEach((project) => { add(project && project.title); add(project && project.description); add(project && project.technologies); });
  return [...new Set(result)].join(' ');
}

function tfidf(documents) {
  const valid = documents.map((document) => Array.isArray(document) ? document.filter(Boolean) : tokens(document));
  const vocabulary = [...new Set(valid.flat())].sort();
  const index = new Map(vocabulary.map((term, position) => [term, position]));
  const documentCount = valid.length || 1;
  const frequency = new Map();
  valid.forEach((document) => [...new Set(document)].forEach((term) => frequency.set(term, (frequency.get(term) || 0) + 1)));
  const idf = new Map(vocabulary.map((term) => [term, Math.log((1 + documentCount) / (1 + (frequency.get(term) || 0))) + 1]));
  const vectors = valid.map((document) => {
    const vector = new Array(vocabulary.length).fill(0);
    if (!document.length) return vector;
    const counts = {};
    document.forEach((term) => { counts[term] = (counts[term] || 0) + 1; });
    Object.entries(counts).forEach(([term, count]) => {
      const position = index.get(term);
      if (position !== undefined) vector[position] = (count / document.length) * (idf.get(term) || 1);
    });
    return vector;
  });
  return { vocabulary, vectors };
}

function cosine(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return 0;
  const length = Math.max(a.length, b.length);
  let dot = 0; let magnitudeA = 0; let magnitudeB = 0;
  for (let i = 0; i < length; i += 1) {
    const left = Number(a[i] || 0); const right = Number(b[i] || 0);
    dot += left * right; magnitudeA += left * left; magnitudeB += right * right;
  }
  if (!magnitudeA || !magnitudeB) return 0;
  return clamp(dot / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB)), 0, 1);
}

function strength(user) {
  let score = 0;
  if (user.profilePicture || user.hasProfilePicture) score += 20;
  if (Array.isArray(user.skills) && user.skills.length >= 3) score += 20;
  if (typeof user.bio === 'string' && user.bio.trim()) score += 20;
  if (Array.isArray(user.projects) && user.projects.length) score += 20;
  if (user.cgpa !== null && user.cgpa !== undefined && user.cgpa !== '') score += 20;
  return score / 100;
}

function availability(value) {
  const normalized = String(value || '').toLowerCase();
  return [normalized === 'weekdays' ? 1 : 0, normalized === 'weekends' ? 1 : 0, normalized === 'flexible' ? 1 : 0];
}

function features(user, seeker, vocabulary, analytics) {
  const terms = new Set([...array(user.skills), ...array(user.interests)]);
  const vector = vocabulary.map((term) => terms.has(term) ? 1 : 0);
  const core = [
    ...vector,
    clamp(number(user.year) / 5, 0, 1),
    user.cgpa === null || user.cgpa === undefined ? 0 : clamp(number(user.cgpa) / 10, 0, 1),
    strength(user),
    ...availability(user.availability),
    String(seeker.department || '').toUpperCase() === String(user.department || '').toUpperCase() ? 1 : 0,
  ];
  const stats = analytics || {};
  return [...core,
    clamp(number(stats.totalInteractions) / 100, 0, 1),
    clamp(number(stats.avgSatisfaction) / 5, 0, 1),
    clamp(number(stats.acceptedMentorships) / 40, 0, 1),
    clamp(number(stats.completionRate), 0, 1),
    clamp(number(stats.subjectBreadth) / 12, 0, 1),
    clamp(number(stats.recencyScore), 0, 1)];
}

function distance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) { const delta = (a[i] || 0) - (b[i] || 0); sum += delta * delta; }
  return Math.sqrt(sum);
}

function mean(points, dimensions) {
  if (!points.length) return new Array(dimensions).fill(0);
  const centroid = new Array(dimensions).fill(0);
  points.forEach((point) => point.forEach((value, index) => { centroid[index] += value || 0; }));
  return centroid.map((value) => value / points.length);
}

function weightedIndex(weights, rng) {
  const total = weights.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return Math.floor(rng() * weights.length);
  let threshold = rng() * total;
  for (let index = 0; index < weights.length; index += 1) {
    threshold -= weights[index];
    if (threshold <= 0) return index;
  }
  return weights.length - 1;
}

function kmeans(points, desiredK, rng) {
  const n = points.length;
  if (!n) return { assignments: [], centroids: [], k: 0, iterations: 0, inertia: 0 };
  if (n < 3) return { assignments: new Array(n).fill(0), centroids: [mean(points, points[0].length)], k: 1, iterations: 1, inertia: 0 };
  const k = clamp(Math.floor(desiredK), 2, n);
  const dimensions = points[0].length;
  const centroids = [[...points[Math.floor(rng() * n)]]];
  while (centroids.length < k) {
    const distances = points.map((point) => {
      let minimum = Number.POSITIVE_INFINITY;
      centroids.forEach((centroid) => { minimum = Math.min(minimum, distance(point, centroid)); });
      return minimum * minimum;
    });
    centroids.push([...points[weightedIndex(distances, rng)]]);
  }
  let assignments = new Array(n).fill(-1); let changed = true; let iterations = 0;
  while (changed && iterations < 35) {
    changed = false; iterations += 1;
    points.forEach((point, pointIndex) => {
      let nearest = 0; let nearestDistance = Number.POSITIVE_INFINITY;
      centroids.forEach((centroid, clusterIndex) => { const current = distance(point, centroid); if (current < nearestDistance) { nearestDistance = current; nearest = clusterIndex; } });
      if (assignments[pointIndex] !== nearest) { assignments[pointIndex] = nearest; changed = true; }
    });
    const groups = Array.from({ length: centroids.length }, () => []);
    assignments.forEach((cluster, pointIndex) => { if (cluster >= 0) groups[cluster].push(points[pointIndex]); });
    groups.forEach((group, clusterIndex) => { centroids[clusterIndex] = group.length ? mean(group, dimensions) : [...points[Math.floor(rng() * n)]]; });
  }
  let inertia = 0;
  assignments.forEach((cluster, pointIndex) => { const current = distance(points[pointIndex], centroids[cluster]); inertia += current * current; });
  return { assignments, centroids, k, iterations, inertia };
}

function jaccard(a, b) {
  if (!a.size && !b.size) return 0;
  let intersection = 0; a.forEach((item) => { if (b.has(item)) intersection += 1; });
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function clusterCount(count) { return count < 3 ? 1 : clamp(Math.round(Math.sqrt(count / 2)), 2, Math.min(6, count)); }

function analyticsFor(candidates, interactions, mentorships, now) {
  const byMentor = {};
  candidates.forEach((candidate) => {
    const id = String(candidate.id || candidate._id);
    const related = interactions.filter((row) => String(row.mentorId || row._id) === id);
    const accepted = mentorships.filter((row) => String(row.mentorId) === id && String(row.status || '').toLowerCase() === 'accepted').length;
    const terminated = mentorships.filter((row) => String(row.mentorId) === id && String(row.status || '').toLowerCase() === 'terminated').length;
    const ratings = related.map((row) => number(row.satisfactionRating)).filter((value) => value > 0);
    const dates = related.map((row) => new Date(row.timestamp || row.createdAt || 0).getTime()).filter(Number.isFinite);
    const last = dates.length ? Math.max(...dates) : 0;
    const subjects = new Set(related.map((row) => row.subjectTag).filter(Boolean));
    byMentor[id] = {
      totalInteractions: related.length,
      avgSatisfaction: ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : 0,
      subjectBreadth: subjects.size,
      acceptedMentorships: accepted,
      completionRate: accepted ? clamp(1 - (terminated / accepted), 0, 1) : 0,
      recencyScore: last ? clamp(1 - ((new Date(now).getTime() - last) / (1000 * 60 * 60 * 24 * 90)), 0, 1) : 0,
    };
  });
  return byMentor;
}

function eligible(seeker, candidates, mentorships, now, weightProfile) {
  const seekerId = String(seeker.id || seeker._id);
  const blocked = new Set(mentorships.filter((row) => ['pending', 'accepted'].includes(String(row.status || '').toLowerCase()) && String(row.menteeId) === seekerId).map((row) => String(row.mentorId)));
  return candidates.filter((candidate) => {
    const id = String(candidate.id || candidate._id);
    if (id === seekerId || candidate.isActive === false || blocked.has(id)) return false;
    if (weightProfile === 'external') {
      return ['senior', 'faculty'].includes(String(candidate.role || '').toLowerCase())
        && candidate.availableForExternalGuidance === true
        && new Date(candidate.externalGuidanceLockedUntil || 0).getTime() > new Date(now).getTime();
    }
    if (!['offering', 'both'].includes(String(candidate.mentorshipIntent || '').toLowerCase())) return false;
    const role = String(candidate.role || '').toLowerCase();
    return role === 'faculty' || role === 'admin' || number(candidate.year, NaN) > number(seeker.year, NaN);
  });
}

function recommend({ seeker, candidates, interactions = [], mentorships = [], options = {} }) {
  const now = options.now || new Date(0).toISOString();
  const weightProfile = options.weightProfile || 'internal';
  const rng = options.rng || mulberry32(options.seed || 0);
  const pool = eligible(seeker, candidates || [], mentorships, now, weightProfile);
  const weights = weightProfile === 'external' ? EXTERNAL_WEIGHTS : INTERNAL_WEIGHTS;
  if (!pool.length) return { ranking: [], model: { version: 'v1', weights, clusterInfo: { clusterCount: 0, clusters: [] } } };
  const analytics = analyticsFor(pool, interactions, mentorships, now);
  const vocabulary = [...new Set(pool.flatMap((candidate) => [...array(candidate.skills), ...array(candidate.interests)]).concat(array(seeker.skills), array(seeker.interests)))].sort();
  const vectors = pool.map((candidate) => features(candidate, seeker, vocabulary, analytics[String(candidate.id || candidate._id)]));
  const documents = [profileText(seeker), ...pool.map(profileText)];
  const text = tfidf(documents);
  const clusters = kmeans(vectors, clusterCount(pool.length), rng);
  const seekerVector = features(seeker, seeker, vocabulary, {});
  const coreLength = seekerVector.length;
  let primary = 0; let minimum = Number.POSITIVE_INFINITY;
  clusters.centroids.forEach((centroid, index) => { const current = distance(seekerVector, centroid.slice(0, coreLength)); if (current < minimum) { minimum = current; primary = index; } });
  const seekerTokens = tokens(documents[0]);
  const ranking = pool.map((candidate, index) => {
    const id = String(candidate.id || candidate._id);
    const cluster = clusters.assignments[index] || 0;
    const centroid = clusters.centroids[cluster] || [];
    const clusterDistance = centroid.length ? clamp(distance(vectors[index], centroid) / Math.sqrt(vectors[index].length || 1), 0, 1) : 0;
    const mentorTokens = tokens(documents[index + 1]);
    const shared = [...new Set(seekerTokens.filter((token) => mentorTokens.includes(token)))].sort().slice(0, 8);
    const needs = new Set([...array(seeker.interests), ...array(seeker.skills)]);
    const capabilities = new Set([...array(candidate.skills), ...array(candidate.interests)]);
    const skillAlignment = jaccard(needs, capabilities);
    const contentSimilarity = cosine(text.vectors[0], text.vectors[index + 1]);
    const sameDepartment = String(seeker.department || '').toUpperCase() === String(candidate.department || '').toUpperCase() ? 1 : 0;
    const progression = clamp((number(candidate.year) - number(seeker.year) + 2) / 6, 0, 1);
    const availabilityMatch = String(candidate.availability || '').toLowerCase() === String(seeker.availability || '').toLowerCase() ? 1 : 0.6;
    const stats = analytics[id] || {};
    const quality = clamp((number(stats.avgSatisfaction) / 5) * 0.6 + number(stats.completionRate) * 0.4, 0, 1);
    const activity = clamp((number(stats.totalInteractions) / 60) * 0.5 + number(stats.recencyScore) * 0.5, 0, 1);
    const fit = clamp(1 - clusterDistance, 0, 1);
    const bonus = cluster === primary ? 0.05 : 0;
    const raw = clamp(skillAlignment * weights.skills + contentSimilarity * weights.interests + sameDepartment * 0.10 + progression * 0.10 + availabilityMatch * weights.availability + quality * weights.goals + activity * 0.11 + strength(candidate) * 0.08 + fit * 0.03 + bonus, 0, 1);
    return {
      id, score: Math.round(raw * 100), scoreRaw: raw,
      components: { skillAlignment: Math.round(skillAlignment * 100), contentSimilarity: Math.round(contentSimilarity * 100), departmentMatch: Math.round(sameDepartment * 100), academicProgression: Math.round(progression * 100), availabilityMatch: Math.round(availabilityMatch * 100), mentorQuality: Math.round(quality * 100), activitySignal: Math.round(activity * 100), profileStrength: Math.round(strength(candidate) * 100), clusterFit: Math.round(fit * 100), clusterBonus: Math.round(bonus * 100) },
      evidence: { sharedContentTokens: shared, explanation: contentSimilarity >= 0.7 ? 'Strong profile overlap across skills, interests, bio, and project experience.' : contentSimilarity >= 0.3 ? 'Moderate profile similarity based on shared skills, interests, and profile information.' : 'Limited textual profile overlap.' },
      meta: { clusterId: cluster, isPrimaryCluster: cluster === primary, distance: Number(clusterDistance.toFixed(4)) },
    };
  });
  ranking.sort((a, b) => b.score - a.score);
  const clusterSummary = Array.from({ length: clusters.k }, (_, index) => ({ clusterId: index, size: clusters.assignments.filter((cluster) => cluster === index).length, ids: clusters.assignments.map((cluster, point) => cluster === index ? String(pool[point].id || pool[point]._id) : null).filter(Boolean) }));
  return { ranking, model: { version: 'v1', weights, clusterInfo: { model: 'kmeans', clusterCount: clusters.k, vocabularySize: vocabulary.length, iterations: clusters.iterations, inertia: Number(clusters.inertia.toFixed(4)), selectedCluster: primary, clusters: clusterSummary } } };
}

module.exports = { recommend, tokenizeProfileText: tokens, buildProfileText: profileText, calculateTfIdf: tfidf, jaccardSimilarity: jaccard, chooseClusterCount: clusterCount };
