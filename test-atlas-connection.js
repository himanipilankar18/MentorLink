/**
 * Test MongoDB Atlas Connection
 * Run: node test-atlas-connection.js
 * 
 * This script tests your MongoDB Atlas connection using Mongoose
 */

require("dotenv").config();
const mongoose = require("mongoose");

async function testAtlasConnection() {
  console.log("\n🔍 Testing MongoDB Atlas Connection...\n");
  
  // Check if MONGODB_URI is set
  if (!process.env.MONGODB_URI) {
    console.error("❌ Error: MONGODB_URI not found in .env file");
    console.error("\n💡 Make sure you have:");
    console.error("   1. Created .env file in project root");
    console.error("   2. Added MONGODB_URI with your Atlas connection string");
    console.error("\n   Example:");
    console.error("   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/mentorlink?retryWrites=true&w=majority\n");
    process.exit(1);
  }

  // Mask password in connection string for display
  const maskedUri = process.env.MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
  console.log("Connection String:", maskedUri);
  console.log("");

  try {
    console.log("⏳ Connecting to MongoDB Atlas...");
    
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log("✅ MongoDB Atlas Connected Successfully!");
    console.log("   Host:", mongoose.connection.host);
    console.log("   Database:", mongoose.connection.name);
    console.log("   Ready State:", mongoose.connection.readyState === 1 ? "Connected" : "Disconnected");
    console.log("");

    // Test a simple operation
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log("📊 Collections:", collections.length > 0 ? collections.map(c => c.name).join(", ") : "None (database is empty)");
    console.log("");

    await mongoose.disconnect();
    console.log("✅ Connection test completed successfully!");
    console.log("   Your MongoDB Atlas connection is working correctly.\n");
    
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Connection Failed!\n");
    console.error("Error:", error.message);
    console.error("");

    // Provide specific troubleshooting based on error
    if (error.message.includes("ECONNREFUSED") || error.message.includes("querySrv")) {
      console.log("💡 Troubleshooting Steps:");
      console.log("   1. Wait 2-3 minutes after adding IP to Atlas whitelist");
      console.log("   2. Verify IP address is whitelisted in Atlas Network Access");
      console.log("   3. Check your internet connection");
      console.log("   4. Try flushing DNS: ipconfig /flushdns (Windows)");
      console.log("   5. Verify cluster is running in Atlas dashboard");
    } else if (error.message.includes("authentication failed") || error.message.includes("bad auth")) {
      console.log("💡 Troubleshooting Steps:");
      console.log("   1. Verify username and password in connection string");
      console.log("   2. URL-encode special characters in password:");
      console.log("      @ → %40, # → %23, $ → %24, % → %25, & → %26");
      console.log("   3. Check database user has correct permissions");
      console.log("   4. Try creating a new database user in Atlas");
    } else if (error.message.includes("Invalid connection string")) {
      console.log("💡 Troubleshooting Steps:");
      console.log("   1. Check connection string format:");
      console.log("      mongodb+srv://username:password@cluster.mongodb.net/mentorlink?retryWrites=true&w=majority");
      console.log("   2. Make sure database name (/mentorlink) is included");
      console.log("   3. Verify no extra spaces or quotes in .env file");
    }

    console.log("\n📖 For detailed setup instructions, see: MONGODB_ATLAS_SETUP.md\n");
    
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}

// Run test
testAtlasConnection();
