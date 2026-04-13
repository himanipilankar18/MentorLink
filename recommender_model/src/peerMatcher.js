function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function normalizeToken(value) {
  if (!value || typeof value !== 'string') return '';
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s.+-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTokenList(values) {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map(normalizeToken).filter(Boolean)));
}

function cosineSimilarity(leftValues, rightValues) {
  const left = new Set(normalizeTokenList(leftValues));
  const right = new Set(normalizeTokenList(rightValues));

  if (!left.size || !right.size) return 0;

  let overlap = 0;
  for (const token of left) {
    if (right.has(token)) overlap += 1;
  }

  return overlap / Math.sqrt(left.size * right.size);
}

function yearCompatibility(requester, helper) {
  const requesterYear = Number(requester.year || 0);
  const helperYear = Number(helper.year || 0);

  if (!requesterYear || !helperYear) return 0.5;

  if (helperYear > requesterYear) return 1;
  if (helperYear === requesterYear) return 0.7;
  return 0.35;
}

function availabilityCompatibility(requester, helper) {
  if (!requester.availability || !helper.availability) return 0.6;
  if (requester.availability === helper.availability) return 1;
  if (requester.availability === 'flexible' || helper.availability === 'flexible') return 0.85;
  return 0.5;
}

function inferHelperStats(interactions) {
  const stats = new Map();

  for (const row of interactions || []) {
    const helperId = String(row.mentorId || '');
    const requesterId = String(row.menteeId || '');
    if (!helperId || !requesterId) continue;

    if (!stats.has(helperId)) {
      stats.set(helperId, {
        sessions: 0,
        completed: 0,
        ratingSum: 0,
        ratingCount: 0,
        uniqueRequesters: new Set(),
      });
    }

    const entry = stats.get(helperId);
    entry.sessions += 1;
    entry.completed += 1;
    entry.uniqueRequesters.add(requesterId);

    if (typeof row.satisfactionRating === 'number' && row.satisfactionRating > 0) {
      entry.ratingSum += row.satisfactionRating;
      entry.ratingCount += 1;
    }
  }

  return stats;
}

function helperReliability(helperStats, helperId) {
  const stats = helperStats.get(String(helperId));
  if (!stats) return 0.35;

  const volume = clamp(Math.log1p(stats.sessions) / Math.log1p(40));
  const quality = stats.ratingCount > 0
    ? clamp((stats.ratingSum / stats.ratingCount - 1) / 4)
    : 0.55;
  const diversity = clamp(stats.uniqueRequesters.size / 20);

  return clamp((0.45 * quality) + (0.35 * volume) + (0.2 * diversity));
}

function reciprocalPenalty(targetUserId, candidateUserId, interactions) {
  let forward = 0;
  let backward = 0;

  for (const row of interactions || []) {
    const helperId = String(row.mentorId || '');
    const requesterId = String(row.menteeId || '');

    if (requesterId === String(targetUserId) && helperId === String(candidateUserId)) forward += 1;
    if (requesterId === String(candidateUserId) && helperId === String(targetUserId)) backward += 1;
  }

  if (!forward && !backward) return 0;
  const reciprocalIntensity = Math.min(forward, backward) / Math.max(forward, backward);
  return clamp(reciprocalIntensity * 0.2);
}

function buildPeerRecommendations(input = {}) {
  const {
    targetUser,
    candidates = [],
    interactions = [],
    topN = 10,
    weights = {},
  } = input;

  if (!targetUser || !targetUser._id) {
    throw new Error('targetUser with _id is required');
  }

  const resolvedWeights = {
    profile: 0.35,
    complementarity: 0.2,
    reliability: 0.25,
    availability: 0.1,
    context: 0.1,
    ...(weights || {}),
  };

  const helperStats = inferHelperStats(interactions);

  const ranked = candidates
    .filter((candidate) => String(candidate._id) !== String(targetUser._id))
    .map((candidate) => {
      const profileSimilarity = cosineSimilarity(
        [...(targetUser.skills || []), ...(targetUser.interests || [])],
        [...(candidate.skills || []), ...(candidate.interests || [])]
      );

      const complementarity = cosineSimilarity(
        targetUser.interests || [],
        candidate.skills || []
      );

      const reliability = helperReliability(helperStats, candidate._id);
      const availability = availabilityCompatibility(targetUser, candidate);
      const context = clamp(
        (0.6 * yearCompatibility(targetUser, candidate)) +
        (0.4 * (targetUser.department === candidate.department ? 1 : 0.55))
      );

      const baseScore = clamp(
        (resolvedWeights.profile * profileSimilarity) +
        (resolvedWeights.complementarity * complementarity) +
        (resolvedWeights.reliability * reliability) +
        (resolvedWeights.availability * availability) +
        (resolvedWeights.context * context)
      );

      const penalty = reciprocalPenalty(targetUser._id, candidate._id, interactions);
      const finalScore = clamp(baseScore - penalty);

      return {
        userId: candidate._id,
        name: candidate.name,
        department: candidate.department,
        year: candidate.year,
        score: Number(finalScore.toFixed(4)),
        breakdown: {
          profileSimilarity: Number(profileSimilarity.toFixed(4)),
          complementarity: Number(complementarity.toFixed(4)),
          reliability: Number(reliability.toFixed(4)),
          availability: Number(availability.toFixed(4)),
          context: Number(context.toFixed(4)),
          reciprocalPenalty: Number(penalty.toFixed(4)),
        },
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.max(1, topN));

  return {
    targetUserId: targetUser._id,
    recommendationCount: ranked.length,
    recommendations: ranked,
    metadata: {
      mode: 'peer_directional_v1',
      signals: ['profileSimilarity', 'complementarity', 'reliability', 'availability', 'context'],
      antiGaming: ['reciprocalPenalty'],
    },
  };
}

module.exports = {
  buildPeerRecommendations,
};
