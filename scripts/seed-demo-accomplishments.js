require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const connectDB = require('../config/database');

const EMAIL_PATTERN = /^mentorlink\.demo(\d+)@spit\.ac\.in$/;
const DEMO_PASSWORD = 'MentorConnectDemo2026';
const departments = ['COMPS', 'CSE', 'IT', 'ECE', 'EEE', 'MECH'];
const topics = [
  ['Python', 'Machine Learning', 'SQL'], ['Java', 'Data Structures', 'C++'],
  ['JavaScript', 'React', 'Node.js'], ['AWS', 'Docker', 'Linux'],
  ['C', 'Embedded Systems', 'Arduino'], ['Figma', 'UI/UX Design', 'React'],
];

function accomplishments(name, index) {
  const topic = topics[index % topics.length];
  return [
    { title: `Demo ${topic[0]} project showcase`, description: `Fictional ${name} demonstration project using ${topic.join(', ')}.`, category: 'Project', achievedAt: new Date(`2026-${String((index % 9) + 1).padStart(2, '0')}-15`), demoOnly: true },
    { title: `Demo ${topic[1]} workshop`, description: `Fictional workshop participation focused on ${topic[1]} and peer learning.`, category: 'Workshop', achievedAt: new Date(`2026-${String((index % 8) + 2).padStart(2, '0')}-10`), demoOnly: true },
    { title: 'Demo technical challenge finalist', description: 'Fictional demo coding or engineering challenge result for presentation testing.', category: 'Competition', achievedAt: new Date(`2025-${String((index % 9) + 1).padStart(2, '0')}-20`), demoOnly: true },
  ];
}

function newUser(index) {
  const number = index + 31;
  const first = ['Nikhil', 'Sara', 'Vivek', 'Manya', 'Parth', 'Leena', 'Aman', 'Diya', 'Rahul', 'Ishani'][index % 10];
  const last = ['Bansal', 'Mehta', 'Joshi', 'Pillai', 'Sharma', 'Kulkarni'][Math.floor(index / 10)];
  const year = index < 8 ? 4 : index < 16 ? 3 : index < 24 ? 2 : 1;
  const topic = topics[index % topics.length];
  const offering = year >= 3 && index % 5 !== 0;
  const name = `${first} ${last}`;
  return {
    name, firstName: first, lastName: last, displayName: name,
    email: `mentorlink.demo${number}@spit.ac.in`, password: DEMO_PASSWORD,
    userType: 'INSTITUTE_MEMBER', instituteRole: 'CURRENT_STUDENT', year,
    department: departments[index % departments.length], role: year >= 3 ? 'senior' : 'junior',
    skills: [...topic, 'Git'], interests: [topic[1], 'Career Preparation'],
    bio: `Fictional MentorConnect demo profile for testing recommendations. ${name} is exploring ${topic[1]} and peer learning.`,
    mentorshipIntent: offering ? (index % 3 === 0 ? 'both' : 'offering') : 'seeking',
    availability: ['flexible', 'weekends', 'weekdays'][index % 3],
    projects: [{ title: `${first}'s demo ${topic[1]} project`, description: `Fictional demo project using ${topic.join(', ')}.`, technologies: topic }],
    demoAccomplishments: accomplishments(name, index),
    profileComplete: true, isVerified: true, isActive: true,
  };
}

async function seed() {
  await connectDB();
  const existing = await User.find({ email: /^mentorlink\.demo\d+@spit\.ac\.in$/ }).select('email name demoAccomplishments').lean();
  const existingEmails = new Set(existing.map((user) => user.email));
  const updates = existing.map((user) => ({
    updateOne: {
      filter: { _id: user._id },
      update: { $set: { demoAccomplishments: user.demoAccomplishments?.length ? user.demoAccomplishments : accomplishments(user.name, Number(user.email.match(EMAIL_PATTERN)?.[1] || 1) - 1) } },
    },
  }));
  if (updates.length) await User.bulkWrite(updates);

  const pending = Array.from({ length: 30 }, (_, index) => newUser(index)).filter((user) => !existingEmails.has(user.email));
  console.log(`Existing demo users preserved: ${existing.length}`);
  console.log(`Additional demo users to create: ${pending.length}`);
  const created = pending.length ? await User.create(pending) : [];
  console.log(JSON.stringify({ createdCount: created.length, accomplishmentUsers: existing.length + created.length, accomplishmentsAdded: (existing.length + created.length) * 3 }, null, 2));
  await mongoose.disconnect();
}

seed().catch(async (error) => {
  console.error('Demo accomplishment seeding failed:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
