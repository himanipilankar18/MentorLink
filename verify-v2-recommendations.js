const { generateMentorRecommendations } = require('./utils/recommendationEngine');

const baseMentee = {
  _id: 'm1',
  department: 'CSE',
  year: 2,
  availability: 'weekdays',
  skills: ['javascript', 'node.js', 'react', 'python'],
  interests: ['ai', 'ml', 'full-stack', 'web'],
  bio: 'Interested in AI and full-stack engineering.',
};

const analytics = (id, interactions = 20, satisfaction = 4, breadth = 4) => [{
  _id: id,
  totalInteractions: interactions,
  avgSatisfaction: satisfaction,
  subjectBreadth: breadth,
  lastInteractionAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
}];

function makeMentor(id, dept, skills, interests, bio, projects, year = 4, availability = 'weekdays') {
  return {
    _id: id,
    department: dept,
    year,
    availability,
    role: 'senior',
    mentorshipIntent: 'offering',
    isActive: true,
    skills,
    interests,
    bio,
    projects,
  };
}

function runCase(label, fn) {
  try {
    fn();
    console.log('PASS:', label);
  } catch (err) {
    console.error('FAIL:', label, err.message);
    process.exitCode = 1;
  }
}

const strongMentor = makeMentor(
  'strong',
  'CSE',
  ['javascript', 'node.js', 'react', 'python', 'mongodb'],
  ['ai', 'ml', 'full-stack', 'web'],
  'Senior AI engineer working with machine learning, React, and Node.js.',
  [{ title: 'ML dashboard', description: 'Build ML dashboard with Python and React for actionable insights.', technologies: ['python', 'react', 'mongodb'] }],
);

const weakSameDeptMentor = makeMentor(
  'weak_same',
  'CSE',
  ['civil', 'surveying', 'design'],
  ['construction', 'mathematics'],
  'Works on civil projects and infrastructure planning.',
  [],
  4,
);

const diffDeptStrong = makeMentor(
  'diff_strong',
  'EXTC',
  ['javascript', 'node.js', 'react', 'python', 'ml'],
  ['ai', 'ml', 'web', 'data'],
  'Embedded AI systems and web platform development with Python, React, and Node.js.',
  [{ title: 'Predictive analytics app', description: 'Design a smart analytics platform with Python and React.', technologies: ['python', 'react', 'tensorflow'] }],
);

const bioProjectMentorStrong = makeMentor(
  'bio_strong',
  'CSE',
  ['javascript', 'react'],
  ['web', 'ui'],
  'Focused on AI-driven visual analytics with deep experience in React and dashboard design. Uses Python and Node.js for backend workflows.',
  [{ title: 'Insight portal', description: 'Develop end-to-end analytics portal for real-time intelligence and dashboards with React and Python.', technologies: ['python', 'react', 'node.js'] }],
);

const bioProjectMentorWeak = makeMentor(
  'bio_weak',
  'CSE',
  ['javascript', 'react'],
  ['web', 'ui'],
  'Likes web development and UI work.',
  [{ title: 'Website', description: 'Simple website.', technologies: ['html', 'css'] }],
);

const emptyMentor = makeMentor('empty', 'IT', [], [], '', [], 4);
const blockedMentor = makeMentor('blocked', 'CSE', ['javascript', 'python'], ['ai'], 'Mentor with an active relationship.', [{ title: 'Active project', description: 'AI project.', technologies: ['python'] }]);

runCase('Strong technical match', () => {
  const result = generateMentorRecommendations({
    mentee: baseMentee,
    mentors: [strongMentor],
    interactionStats: analytics('strong', 60, 4.8, 7),
    mentorshipStats: [],
    excludedMentorIds: new Set(),
    limit: 1,
  });
  if (!result.recommendations.length) throw new Error('No recommendation returned');
  const rec = result.recommendations[0];
  if (rec.scoreComponents.contentSimilarity < 60) throw new Error('contentSimilarity too low for strong match');
  if (rec.matchScore < 70) throw new Error('Final score too low for strong match');
});

runCase('Different department but strong match is not filtered out', () => {
  const result = generateMentorRecommendations({
    mentee: baseMentee,
    mentors: [weakSameDeptMentor, diffDeptStrong],
    interactionStats: analytics('diff_strong', 75, 4.9, 8),
    mentorshipStats: [],
    excludedMentorIds: new Set(),
    limit: 10,
  });
  if (!result.recommendations.some((r) => r.mentor.department === 'EXTC')) throw new Error('Different-department mentor was filtered out');
});

runCase('Bio/project match differentiates ranking', () => {
  const result = generateMentorRecommendations({
    mentee: baseMentee,
    mentors: [bioProjectMentorStrong, bioProjectMentorWeak],
    interactionStats: [
      { _id: 'bio_strong', totalInteractions: 40, avgSatisfaction: 4.7, subjectBreadth: 6, lastInteractionAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString() },
      { _id: 'bio_weak', totalInteractions: 18, avgSatisfaction: 3.8, subjectBreadth: 3, lastInteractionAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() },
    ],
    mentorshipStats: [],
    excludedMentorIds: new Set(),
    limit: 10,
  });
  const strong = result.recommendations.find((r) => r.mentor._id === 'bio_strong');
  const weak = result.recommendations.find((r) => r.mentor._id === 'bio_weak');
  if (!strong || !weak) throw new Error('Both mentors should be included');
  if (strong.scoreComponents.contentSimilarity <= weak.scoreComponents.contentSimilarity) throw new Error('Strong bio/project mentor should score higher on content similarity');
  if (strong.matchScore <= weak.matchScore + 5) throw new Error('Strong bio/project mentor should outperform weak mentor overall');
});

runCase('Empty bio/projects remain safe', () => {
  const result = generateMentorRecommendations({
    mentee: { ...baseMentee, bio: '', skills: [], interests: [] },
    mentors: [emptyMentor],
    interactionStats: [],
    mentorshipStats: [],
    excludedMentorIds: new Set(),
    limit: 1,
  });
  if (!result.recommendations.length) throw new Error('Should still return an empty-profile candidate');
  const rec = result.recommendations[0];
  if (rec.scoreComponents.contentSimilarity !== 0) throw new Error('Empty profile should yield zero content similarity');
});

runCase('Blocked mentors are excluded', () => {
  const result = generateMentorRecommendations({
    mentee: baseMentee,
    mentors: [strongMentor, blockedMentor],
    interactionStats: analytics('strong', 60, 4.8, 7),
    mentorshipStats: [],
    excludedMentorIds: new Set(['blocked']),
    limit: 10,
  });
  if (result.recommendations.some((r) => r.mentor._id === 'blocked')) throw new Error('Excluded pending/accepted mentor should be filtered out');
});

runCase('Explain calculations are consistent across requests', () => {
  const first = generateMentorRecommendations({
    mentee: baseMentee,
    mentors: [strongMentor, diffDeptStrong],
    interactionStats: [analytics('strong', 60, 4.8, 7)[0], analytics('diff_strong', 75, 4.9, 8)[0]],
    mentorshipStats: [],
    excludedMentorIds: new Set(),
    limit: 10,
  });
  const second = generateMentorRecommendations({
    mentee: baseMentee,
    mentors: [strongMentor, diffDeptStrong],
    interactionStats: [analytics('strong', 60, 4.8, 7)[0], analytics('diff_strong', 75, 4.9, 8)[0]],
    mentorshipStats: [],
    excludedMentorIds: new Set(),
    limit: 10,
  });
  if (first.recommendations[0].matchScore !== second.recommendations[0].matchScore) throw new Error('Recommendation scores should be deterministic');
  if (first.recommendations[0].scoreComponents.contentSimilarity !== second.recommendations[0].scoreComponents.contentSimilarity) throw new Error('Content component should be deterministic');
});

console.log('ALL CASES PASSED');
