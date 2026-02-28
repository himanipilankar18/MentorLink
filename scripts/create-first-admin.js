/**
 * Bootstrap Script: Create First Admin User
 * 
 * This script creates the very first admin user in the system.
 * Run this ONCE when setting up the application for the first time.
 * 
 * Usage: node scripts/create-first-admin.js
 * 
 * After running this script:
 * 1. Log in with the credentials shown
 * 2. IMMEDIATELY change the password
 * 3. This admin can then create other admins via the /api/auth/create-admin endpoint
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const connectDB = require('../config/database');

// Default admin credentials (MUST be changed after first login)
const FIRST_ADMIN = {
  name: 'System Administrator',
  email: 'admin@spit.ac.in',
  password: 'Admin@123',  // ⚠️ CHANGE THIS AFTER FIRST LOGIN
  department: 'CSE',
  role: 'admin',
  isVerified: true,
  profileComplete: true
};

async function createFirstAdmin() {
  try {
    console.log('🔌 Connecting to database...');
    await connectDB();
    console.log('✅ Connected to MongoDB\n');

    // Check if any admin already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log('❌ Admin user already exists!');
      console.log(`   Email: ${existingAdmin.email}`);
      console.log(`   Name: ${existingAdmin.name}\n`);
      console.log('💡 If you need to create another admin, use the protected endpoint:');
      console.log('   POST /api/auth/create-admin (requires admin authentication)\n');
      process.exit(0);
    }

    // Create the first admin
    console.log('👤 Creating first admin user...');
    const admin = await User.create(FIRST_ADMIN);

    console.log('\n✅ First admin user created successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Email:    ', admin.email);
    console.log('🔑 Password: ', FIRST_ADMIN.password);
    console.log('👤 Name:     ', admin.name);
    console.log('🎯 Role:     ', admin.role);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('⚠️  IMPORTANT SECURITY STEPS:');
    console.log('   1. Log in at: http://localhost:5000/login.html');
    console.log('   2. Go to Profile → Change Password');
    console.log('   3. Set a strong, unique password');
    console.log('   4. Save the new credentials securely\n');

    console.log('👥 To create additional admin users:');
    console.log('   - Log in as this admin');
    console.log('   - Use POST /api/auth/create-admin endpoint');
    console.log('   - Requires admin JWT token in Authorization header\n');

    console.log('🎉 Setup complete! You can now start the server.\n');

  } catch (error) {
    console.error('\n❌ Error creating admin user:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed.');
  }
}

// Run the script
createFirstAdmin();
