/**
 * Test MongoDB Connection
 * Run: node test-connection.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function testConnection() {
  console.log('\n🔍 Testing MongoDB Connection...\n');
  console.log('Connection String:', process.env.MONGODB_URI?.replace(/\/\/.*@/, '//***:***@') || 'NOT SET');
  console.log('');

  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/peerly');
    console.log('✅ MongoDB Connected Successfully!');
    console.log('   Host:', mongoose.connection.host);
    console.log('   Database:', mongoose.connection.name);
    console.log('');
    
    // Test a simple operation
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('📊 Collections:', collections.length > 0 ? collections.map(c => c.name).join(', ') : 'None (database is empty)');
    
    await mongoose.disconnect();
    console.log('\n✅ Connection test completed successfully!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Connection Failed!\n');
    console.error('Error:', error.message);
    console.error('');
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('💡 Troubleshooting:');
      console.log('   1. Check if MongoDB is running (local) or connection string is correct (Atlas)');
      console.log('   2. For Atlas: Verify network access and credentials');
      console.log('   3. Try: mongodb://localhost:27017/peerly for local MongoDB');
    } else if (error.message.includes('authentication failed')) {
      console.log('💡 Troubleshooting:');
      console.log('   1. Check username and password in connection string');
      console.log('   2. Verify database user has correct permissions');
      console.log('   3. URL-encode special characters in password (@ → %40, # → %23, etc.)');
    } else if (error.message.includes('querySrv')) {
      console.log('💡 Troubleshooting:');
      console.log('   1. Check your internet connection');
      console.log('   2. Verify MongoDB Atlas cluster is running');
      console.log('   3. Check network access whitelist in Atlas dashboard');
    }
    
    console.log('\n📖 See MONGODB_SETUP.md for detailed instructions\n');
    process.exit(1);
  }
}

testConnection();
