/**
 * Test Setup Script - Create test users and update profiles
 * Run: node scripts/setup-test-users.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const connectDB = require('../config/database');
const jwt = require('jsonwebtoken');

const TEST_PASSWORD = 'TestPass123';
const TEST_USERS = [
  {
    name: 'testStudent1',
    email: 'teststudent1@spit.ac.in',
    year: 2,
    department: 'CSE',
    role: 'junior',
    skills: ['Python', 'JavaScript', 'React', 'MongoDB'],
    interests: ['Web Development', 'AI/ML'],
    cgpa: 8.5,
    bio: 'Second year student eager to learn full-stack web development and explore AI/ML concepts. Looking for mentorship in building scalable applications.',
    mentorshipIntent: 'seeking',
    availability: 'weekends',
    projects: [
      {
        title: 'Todo List App',
        description: 'A simple todo application built with React and Node.js',
        technologies: ['React', 'Node.js', 'MongoDB'],
      },
      {
        title: 'Personal Portfolio Website',
        description: 'Portfolio showcasing projects and skills',
        technologies: ['HTML', 'CSS', 'JavaScript'],
      },
    ],
    profileComplete: true,
    isVerified: true,
  },
  {
    name: 'testStudent2',
    email: 'teststudent2@spit.ac.in',
    year: 3,
    department: 'CSE',
    role: 'senior',
    skills: ['Python', 'JavaScript', 'React', 'MongoDB', 'Node.js', 'DevOps', 'SQL'],
    interests: ['Web Development', 'System Design', 'DevOps'],
    cgpa: 9.2,
    bio: 'Third year student with strong full-stack development experience. Passionate about mentoring juniors and sharing knowledge about system design and DevOps practices.',
    mentorshipIntent: 'offering',
    availability: 'flexible',
    projects: [
      {
        title: 'E-commerce Platform',
        description: 'Full-stack e-commerce application with payment integration',
        technologies: ['React', 'Node.js', 'MongoDB', 'Stripe'],
      },
      {
        title: 'Real-time Chat Application',
        description: 'Chat app with WebSocket support for real-time messaging',
        technologies: ['Socket.io', 'React', 'Express', 'MongoDB'],
      },
      {
        title: 'CI/CD Pipeline Setup',
        description: 'Automated deployment pipeline with Docker and GitHub Actions',
        technologies: ['Docker', 'GitHub Actions', 'Node.js'],
      },
    ],
    profileComplete: true,
    isVerified: true,
  },
];

async function setupTestUsers() {
  try {
    console.log('\n🔌 Connecting to MongoDB...');
    await connectDB();
    console.log('✅ MongoDB Connected\n');

    console.log('🧹 Cleaning up old test users...');
    await User.deleteMany({
      email: { $in: TEST_USERS.map((u) => u.email) },
    });
    console.log('✅ Old test users removed\n');

    console.log('👤 Creating test users...\n');
    const createdUsers = [];

    for (const userData of TEST_USERS) {
      const user = await User.create({
        ...userData,
        password: TEST_PASSWORD,
        isVerified: true,
        isActive: true,
      });

      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE || '7d',
      });

      createdUsers.push({
        name: user.name,
        email: user.email,
        userId: user._id,
        token,
        year: user.year,
        role: user.role,
      });

      console.log(`✅ Created: ${user.name}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Year: ${user.year}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Skills: ${user.skills.join(', ')}`);
      console.log(`   Interests: ${user.interests.join(', ')}`);
      console.log(`   Token: ${token.slice(0, 50)}...\n`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('TEST USERS SETUP COMPLETE');
    console.log('='.repeat(80) + '\n');

    console.log('🔐 LOGIN CREDENTIALS:');
    console.log(`   Username: testStudent1@spit.ac.in or testStudent2@spit.ac.in`);
    console.log(`   Password: ${TEST_PASSWORD}\n`);

    console.log('📋 USER DETAILS:\n');
    createdUsers.forEach((user) => {
      console.log(`${user.name.toUpperCase()}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Year: ${user.year}`);
      console.log(`  Role: ${user.role}`);
      console.log(`  User ID: ${user.userId}`);
      console.log(`  Token: ${user.token}\n`);
    });

    console.log('📌 NEXT STEPS:\n');
    console.log('1. Start backend server:');
    console.log('   npm start\n');

    console.log('2. Get fresh tokens via login (optional, tokens above are valid):');
    console.log('   POST http://localhost:5000/api/auth/login');
    console.log('   {');
    console.log('     "email": "teststudent1@spit.ac.in",');
    console.log('     "password": "TestPass123"');
    console.log('   }\n');

    console.log('3. Test ML recommendations:');
    console.log('   GET http://localhost:5000/api/recommendations/mentors');
    console.log('   Header: Authorization: Bearer <TOKEN_FROM_TESTSTUDENT1>\n');

    console.log('4. Create mentorship request:');
    console.log('   POST http://localhost:5000/api/mentorship/request');
    console.log('   Header: Authorization: Bearer <TOKEN_FROM_TESTSTUDENT1>');
    console.log('   Body: { "recipientId": "<USER_ID_OF_TESTSTUDENT2>", "reason": "Learn from your experience" }\n');

    await mongoose.disconnect();
    console.log('✅ Setup complete! MongoDB disconnected.\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

setupTestUsers();
