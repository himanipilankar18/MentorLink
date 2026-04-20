function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeTextArray(values) {
  if (!Array.isArray(values)) return [];

  const normalized = values
    .map((item) => String(item || '').trim().toLowerCase())
    .filter(Boolean);

  return Array.from(new Set(normalized));
}

function profileStrength(user) {
  let score = 0;

  if (user.profilePicture) score += 20;
  if (Array.isArray(user.skills) && user.skills.length >= 3) score += 20;
  if (typeof user.bio === 'string' && user.bio.trim().length > 0) score += 20;
  if (Array.isArray(user.projects) && user.projects.length > 0) score += 20;
  if (user.cgpa !== null && user.cgpa !== undefined && user.cgpa !== '') score += 20;

  return score / 100;
}

function buildSkillVocabulary(mentee, mentors) {
  const vocabSet = new Set();

  normalizeTextArray(mentee.skills).forEach((skill) => vocabSet.add(skill));
  normalizeTextArray(mentee.interests).forEach((skill) => vocabSet.add(skill));

  mentors.forEach((mentor) => {
    normalizeTextArray(mentor.skills).forEach((skill) => vocabSet.add(skill));
    normalizeTextArray(mentor.interests).forEach((skill) => vocabSet.add(skill));
  });

  return Array.from(vocabSet).sort();
}

function encodeAvailability(value) {
  const availability = String(value || '').toLowerCase();
  return [
    availability === 'weekdays' ? 1 : 0,
    availability === 'weekends' ? 1 : 0,
    availability === 'flexible' ? 1 : 0,
  ];
}

function encodeDepartmentMatch(menteeDepartment, mentorDepartment) {
  return String(menteeDepartment || '').toUpperCase() === String(mentorDepartment || '').toUpperCase() ? 1 : 0;
}

function buildCoreFeatureVector(sourceUser, referenceMentee, vocabulary) {
  const skills = new Set(normalizeTextArray(sourceUser.skills));
  const interests = new Set(normalizeTextArray(sourceUser.interests));

  const skillFeatures = vocabulary.map((token) => (skills.has(token) || interests.has(token) ? 1 : 0));

  const year = clamp(toNumber(sourceUser.year, 0) / 5, 0, 1);
  const cgpa = sourceUser.cgpa === null || sourceUser.cgpa === undefined ? 0 : clamp(toNumber(sourceUser.cgpa, 0) / 10, 0, 1);
  const availability = encodeAvailability(sourceUser.availability);

  return [
    ...skillFeatures,
    year,
    cgpa,
    profileStrength(sourceUser),
    ...availability,
    encodeDepartmentMatch(referenceMentee.department, sourceUser.department),
  ];
}

function buildMentorFeatureVector(mentor, mentee, vocabulary, mentorAnalytics) {
  const core = buildCoreFeatureVector(mentor, mentee, vocabulary);
  const stats = mentorAnalytics[String(mentor._id)] || {};

  const totalInteractions = clamp(toNumber(stats.totalInteractions, 0) / 100, 0, 1);
  const avgSatisfaction = clamp(toNumber(stats.avgSatisfaction, 0) / 5, 0, 1);
  const acceptedCount = clamp(toNumber(stats.acceptedMentorships, 0) / 40, 0, 1);
  const completionRate = clamp(toNumber(stats.completionRate, 0), 0, 1);
  const topicBreadth = clamp(toNumber(stats.subjectBreadth, 0) / 12, 0, 1);
  const recency = clamp(toNumber(stats.recencyScore, 0), 0, 1);

  return [
    ...core,
    totalInteractions,
    avgSatisfaction,
    acceptedCount,
    completionRate,
    topicBreadth,
    recency,
  ];
}

function euclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const diff = (a[i] || 0) - (b[i] || 0);
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

function meanVector(vectors, dimensions) {
  if (!vectors.length) return new Array(dimensions).fill(0);

  const centroid = new Array(dimensions).fill(0);

  vectors.forEach((vector) => {
    for (let i = 0; i < dimensions; i += 1) {
      centroid[i] += vector[i] || 0;
    }
  });

  for (let i = 0; i < dimensions; i += 1) {
    centroid[i] /= vectors.length;
  }

  return centroid;
}

function weightedRandomIndex(weights) {
  const total = weights.reduce((acc, value) => acc + value, 0);
  if (total <= 0) return Math.floor(Math.random() * weights.length);

  let threshold = Math.random() * total;
  for (let i = 0; i < weights.length; i += 1) {
    threshold -= weights[i];
    if (threshold <= 0) return i;
  }

  return weights.length - 1;
}

function initializeCentroidsKMeansPlusPlus(points, k) {
  const centroids = [];
  const firstIndex = Math.floor(Math.random() * points.length);
  centroids.push([...points[firstIndex]]);

  while (centroids.length < k) {
    const distances = points.map((point) => {
      let minDistance = Number.POSITIVE_INFINITY;
      centroids.forEach((centroid) => {
        const distance = euclideanDistance(point, centroid);
        if (distance < minDistance) minDistance = distance;
      });
      return minDistance * minDistance;
    });

    const nextIndex = weightedRandomIndex(distances);
    centroids.push([...points[nextIndex]]);
  }

  return centroids;
}

function runKMeans(points, desiredK, maxIterations = 35) {
  const n = points.length;
  if (n === 0) {
    return {
      assignments: [],
      centroids: [],
      k: 0,
      iterations: 0,
      inertia: 0,
    };
  }

  if (n < 3) {
    return {
      assignments: new Array(n).fill(0),
      centroids: [meanVector(points, points[0].length)],
      k: 1,
      iterations: 1,
      inertia: 0,
    };
  }

  const k = clamp(Math.floor(desiredK), 2, n);
  const dimensions = points[0].length;
  let centroids = initializeCentroidsKMeansPlusPlus(points, k);
  let assignments = new Array(n).fill(-1);
  let changed = true;
  let iterations = 0;

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations += 1;

    for (let i = 0; i < n; i += 1) {
      let nearestCluster = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;

      for (let c = 0; c < centroids.length; c += 1) {
        const distance = euclideanDistance(points[i], centroids[c]);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestCluster = c;
        }
      }

      if (assignments[i] !== nearestCluster) {
        assignments[i] = nearestCluster;
        changed = true;
      }
    }

    const groups = Array.from({ length: centroids.length }, () => []);
    assignments.forEach((clusterIndex, pointIndex) => {
      if (clusterIndex >= 0) {
        groups[clusterIndex].push(points[pointIndex]);
      }
    });

    centroids = centroids.map((previousCentroid, centroidIndex) => {
      if (!groups[centroidIndex].length) {
        return [...points[Math.floor(Math.random() * n)]];
      }

      return meanVector(groups[centroidIndex], dimensions);
    });
  }

  let inertia = 0;
  assignments.forEach((clusterIndex, pointIndex) => {
    const distance = euclideanDistance(points[pointIndex], centroids[clusterIndex]);
    inertia += distance * distance;
  });

  return {
    assignments,
    centroids,
    k,
    iterations,
    inertia,
  };
}

function jaccardSimilarity(setA, setB) {
  if (!setA.size && !setB.size) return 0;
  let intersection = 0;
  setA.forEach((item) => {
    if (setB.has(item)) intersection += 1;
  });
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function calculateCompatibilityBreakdown(mentee, mentor, analytics, clusterDistance, isPrimaryCluster) {
  const menteeNeeds = new Set([
    ...normalizeTextArray(mentee.interests),
    ...normalizeTextArray(mentee.skills),
  ]);

  const mentorCapabilities = new Set([
    ...normalizeTextArray(mentor.skills),
    ...normalizeTextArray(mentor.interests),
  ]);

  const skillAlignment = jaccardSimilarity(menteeNeeds, mentorCapabilities);
  const sameDepartment = String(mentee.department || '').toUpperCase() === String(mentor.department || '').toUpperCase() ? 1 : 0;
  const yearProgression = clamp((toNumber(mentor.year, 0) - toNumber(mentee.year, 0) + 2) / 6, 0, 1);
  const availability = String(mentor.availability || '').toLowerCase() === String(mentee.availability || '').toLowerCase() ? 1 : 0.6;
  const mentorQuality = clamp((toNumber(analytics.avgSatisfaction, 0) / 5) * 0.6 + toNumber(analytics.completionRate, 0) * 0.4, 0, 1);
  const activitySignal = clamp((toNumber(analytics.totalInteractions, 0) / 60) * 0.5 + toNumber(analytics.recencyScore, 0) * 0.5, 0, 1);
  const clusterFit = clamp(1 - clusterDistance, 0, 1);

  const weightedScore = (
    skillAlignment * 0.28 +
    sameDepartment * 0.1 +
    yearProgression * 0.1 +
    availability * 0.08 +
    mentorQuality * 0.18 +
    activitySignal * 0.11 +
    profileStrength(mentor) * 0.1 +
    clusterFit * 0.05
  );

  const clusterBonus = isPrimaryCluster ? 0.08 : 0;
  const finalScore = clamp(weightedScore + clusterBonus, 0, 1);

  return {
    finalScore,
    score: Math.round(finalScore * 100),
    components: {
      skillAlignment: Math.round(skillAlignment * 100),
      departmentMatch: Math.round(sameDepartment * 100),
      academicProgression: Math.round(yearProgression * 100),
      availabilityMatch: Math.round(availability * 100),
      mentorQuality: Math.round(mentorQuality * 100),
      activitySignal: Math.round(activitySignal * 100),
      profileStrength: Math.round(profileStrength(mentor) * 100),
      clusterFit: Math.round(clusterFit * 100),
      clusterBonus: Math.round(clusterBonus * 100),
    },
  };
}

function summarizeClusters(assignments, mentors, k) {
  const summary = Array.from({ length: k }, (_, index) => ({
    clusterId: index,
    size: 0,
    mentorIds: [],
  }));

  assignments.forEach((clusterId, idx) => {
    const bucket = summary[clusterId];
    if (!bucket) return;
    bucket.size += 1;
    bucket.mentorIds.push(String(mentors[idx]._id));
  });

  return summary;
}

function chooseClusterCount(mentorCount) {
  if (mentorCount < 3) return 1;
  const heuristic = Math.round(Math.sqrt(mentorCount / 2));
  return clamp(heuristic, 2, Math.min(6, mentorCount));
}

function buildMentorAnalyticsMap(mentors, interactionStatsByMentor, mentorshipStatsByMentor) {
  const analyticsMap = {};

  mentors.forEach((mentor) => {
    const mentorId = String(mentor._id);
    const interactionStats = interactionStatsByMentor[mentorId] || {};
    const mentorshipStats = mentorshipStatsByMentor[mentorId] || {};

    const lastInteractionAt = interactionStats.lastInteractionAt ? new Date(interactionStats.lastInteractionAt) : null;
    const now = Date.now();
    const recencyScore = lastInteractionAt
      ? clamp(1 - ((now - lastInteractionAt.getTime()) / (1000 * 60 * 60 * 24 * 90)), 0, 1)
      : 0;

    const acceptedMentorships = toNumber(mentorshipStats.accepted, 0);
    const terminatedMentorships = toNumber(mentorshipStats.terminated, 0);
    const activeMentorships = toNumber(mentorshipStats.pending, 0) + acceptedMentorships;
    const completionRate = acceptedMentorships === 0
      ? 0
      : clamp(1 - (terminatedMentorships / acceptedMentorships), 0, 1);

    analyticsMap[mentorId] = {
      totalInteractions: toNumber(interactionStats.totalInteractions, 0),
      avgSatisfaction: toNumber(interactionStats.avgSatisfaction, 0),
      subjectBreadth: toNumber(interactionStats.subjectBreadth, 0),
      acceptedMentorships,
      activeMentorships,
      completionRate,
      recencyScore,
    };
  });

  return analyticsMap;
}

function toKeyedMap(rows, keyField, mapper) {
  return rows.reduce((acc, row) => {
    const key = String(row[keyField]);
    acc[key] = mapper(row);
    return acc;
  }, {});
}

function generateMentorRecommendations({
  mentee,
  mentors,
  interactionStats = [],
  mentorshipStats = [],
  excludedMentorIds = new Set(),
  limit = 10,
}) {
  if (!mentee || !Array.isArray(mentors)) {
    return {
      recommendations: [],
      clustering: {
        model: 'kmeans',
        clusterCount: 0,
        vocabularySize: 0,
        iterations: 0,
        inertia: 0,
        selectedCluster: 0,
        clusters: [],
      },
    };
  }

  const eligibleMentors = mentors.filter((mentor) => !excludedMentorIds.has(String(mentor._id)));
  if (!eligibleMentors.length) {
    return {
      recommendations: [],
      clustering: {
        model: 'kmeans',
        clusterCount: 0,
        vocabularySize: 0,
        iterations: 0,
        inertia: 0,
        selectedCluster: 0,
        clusters: [],
      },
    };
  }

  const interactionStatsMap = toKeyedMap(interactionStats, '_id', (row) => ({
    totalInteractions: row.totalInteractions,
    avgSatisfaction: row.avgSatisfaction,
    subjectBreadth: row.subjectBreadth,
    lastInteractionAt: row.lastInteractionAt,
  }));

  const mentorshipStatsMap = mentorshipStats.reduce((acc, row) => {
    const mentorId = String(row._id.mentorId);
    if (!acc[mentorId]) {
      acc[mentorId] = {
        pending: 0,
        accepted: 0,
        rejected: 0,
        terminated: 0,
      };
    }

    acc[mentorId][String(row._id.status || 'pending').toLowerCase()] = row.count;
    return acc;
  }, {});

  const mentorAnalytics = buildMentorAnalyticsMap(eligibleMentors, interactionStatsMap, mentorshipStatsMap);
  const vocabulary = buildSkillVocabulary(mentee, eligibleMentors);
  const mentorVectors = eligibleMentors.map((mentor) => buildMentorFeatureVector(mentor, mentee, vocabulary, mentorAnalytics));

  const k = chooseClusterCount(eligibleMentors.length);
  const clusteringResult = runKMeans(mentorVectors, k);

  const menteeCoreVector = buildCoreFeatureVector(mentee, mentee, vocabulary);
  const centroidCoreVectors = clusteringResult.centroids.map((centroid) => centroid.slice(0, menteeCoreVector.length));

  let selectedCluster = 0;
  let minClusterDistance = Number.POSITIVE_INFINITY;
  centroidCoreVectors.forEach((centroid, idx) => {
    const distance = euclideanDistance(menteeCoreVector, centroid);
    if (distance < minClusterDistance) {
      minClusterDistance = distance;
      selectedCluster = idx;
    }
  });

  const recommendations = eligibleMentors.map((mentor, index) => {
    const mentorId = String(mentor._id);
    const assignedCluster = clusteringResult.assignments[index] || 0;
    const centroid = clusteringResult.centroids[assignedCluster] || [];
    const clusterDistance = centroid.length ? euclideanDistance(mentorVectors[index], centroid) : 0;
    const clusterDistanceNormalized = clamp(clusterDistance / Math.sqrt(mentorVectors[index].length || 1), 0, 1);
    const isPrimaryCluster = assignedCluster === selectedCluster;
    const analytics = mentorAnalytics[mentorId] || {};
    const scoreDetails = calculateCompatibilityBreakdown(
      mentee,
      mentor,
      analytics,
      clusterDistanceNormalized,
      isPrimaryCluster,
    );

    return {
      mentor,
      mentorAnalytics: {
        totalInteractions: analytics.totalInteractions || 0,
        avgSatisfaction: Number((analytics.avgSatisfaction || 0).toFixed(2)),
        completionRate: Number(((analytics.completionRate || 0) * 100).toFixed(1)),
        recencyScore: Number(((analytics.recencyScore || 0) * 100).toFixed(1)),
        activeMentorships: analytics.activeMentorships || 0,
        subjectBreadth: analytics.subjectBreadth || 0,
      },
      matchScore: scoreDetails.score,
      scoreComponents: scoreDetails.components,
      cluster: {
        clusterId: assignedCluster,
        isPrimaryCluster,
        distance: Number(clusterDistanceNormalized.toFixed(4)),
      },
    };
  });

  recommendations.sort((a, b) => b.matchScore - a.matchScore);

  return {
    recommendations: recommendations.slice(0, clamp(toNumber(limit, 10), 1, 50)),
    clustering: {
      model: 'kmeans',
      clusterCount: clusteringResult.k,
      vocabularySize: vocabulary.length,
      iterations: clusteringResult.iterations,
      inertia: Number(clusteringResult.inertia.toFixed(4)),
      selectedCluster,
      clusters: summarizeClusters(clusteringResult.assignments, eligibleMentors, clusteringResult.k),
    },
  };
}

module.exports = {
  generateMentorRecommendations,
};
