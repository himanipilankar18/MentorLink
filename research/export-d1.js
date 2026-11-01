'use strict';

require('dotenv').config();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const User = require('../models/User');
const Interaction = require('../models/Interaction');
const Mentorship = require('../models/Mentorship');

const root = path.resolve(__dirname, '..');
const dataDir = path.join(__dirname, 'data');
const output = path.join(dataDir, 'd1_snapshot.json');
const salt = process.env.D1_ID_SALT || 'mentorlink-d1-v1-local-salt';

function pseudonym(value) {
  return crypto.createHash('sha256').update(`${salt}:${String(value)}`).digest('hex').slice(0, 24);
}

function id(value) { return value === null || value === undefined ? null : pseudonym(value); }

function projectUser(user) {
  return {
    id: id(user._id),
    year: user.year ?? null,
    department: user.department ?? null,
    role: user.role ?? null,
    userType: user.userType ?? null,
    skills: Array.isArray(user.skills) ? user.skills : [],
    interests: Array.isArray(user.interests) ? user.interests : [],
    bio: user.bio ?? '',
    projects: Array.isArray(user.projects) ? user.projects.map((project) => ({
      title: project.title ?? '',
      description: project.description ?? '',
      technologies: Array.isArray(project.technologies) ? project.technologies : [],
    })) : [],
    availability: user.availability ?? null,
    mentorshipIntent: user.mentorshipIntent ?? null,
    cgpa: user.cgpa ?? null,
    hasProfilePicture: Boolean(user.profilePicture),
    isActive: Boolean(user.isActive),
    availableForExternalGuidance: Boolean(user.availableForExternalGuidance),
    externalGuidanceLockedUntil: user.externalGuidanceLockedUntil ?? null,
  };
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    const userDocs = await User.find({}).select('year department role userType skills interests bio projects availability mentorshipIntent cgpa profilePicture isActive availableForExternalGuidance externalGuidanceLockedUntil').lean();
    const users = userDocs.map(projectUser);
    const interactions = (await Interaction.find({}).select('mentorId menteeId confirmationStatus satisfactionRating status timestamp createdAt subjectTag').lean()).map((row) => ({
      mentorId: id(row.mentorId), menteeId: id(row.menteeId), confirmationStatus: row.confirmationStatus ?? null,
      satisfactionRating: row.satisfactionRating ?? null, status: row.status ?? null,
      timestamp: row.timestamp ?? null, createdAt: row.createdAt ?? null, subjectTag: row.subjectTag ?? null,
    }));
    const mentorships = (await Mentorship.find({}).select('mentorId menteeId status createdAt updatedAt requestedAt acceptedAt terminatedAt').lean()).map((row) => ({
      mentorId: id(row.mentorId), menteeId: id(row.menteeId), status: row.status ?? null,
      createdAt: row.createdAt ?? null, updatedAt: row.updatedAt ?? null,
      requestedAt: row.requestedAt ?? null, acceptedAt: row.acceptedAt ?? null, terminatedAt: row.terminatedAt ?? null,
    }));
    const provenance = fs.existsSync(path.join(dataDir, 'real_accounts.local.txt')) ? 'real' : 'unknown';
    const snapshot = {
      schema: 'd1-v1',
      provenance,
      generatedAt: new Date().toISOString(),
      users,
      interactions,
      mentorships,
    };
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(output, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify({ output: path.relative(root, output), provenance, userCount: users.length, interactionCount: interactions.length, mentorshipCount: mentorships.length }));
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(`D1 export failed: ${error.message}`);
  process.exitCode = 1;
});
