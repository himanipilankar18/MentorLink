/**
 * Verify .env File Configuration
 * Run: node verify-env.js
 * 
 * This script checks if your .env file has the correct format
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");

console.log("\n🔍 Verifying .env File Configuration...\n");

// Check if .env file exists
const envPath = path.join(process.cwd(), ".env");
if (!fs.existsSync(envPath)) {
  console.error("❌ .env file not found!");
  console.error("   Create a .env file in your project root.\n");
  process.exit(1);
}

console.log("✅ .env file found\n");

// Read .env file
const envContent = fs.readFileSync(envPath, "utf8");
const lines = envContent.split("\n");

// Check MONGODB_URI
let mongodbUri = process.env.MONGODB_URI;
let mongodbUriLine = lines.find(line => line.startsWith("MONGODB_URI"));

if (!mongodbUri) {
  console.error("❌ MONGODB_URI not found in .env file\n");
  process.exit(1);
}

console.log("📋 Current MONGODB_URI:");
console.log("   " + (mongodbUriLine || "Not found in file"));
console.log("");

// Mask password for display
const maskedUri = mongodbUri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
console.log("🔐 Masked Connection String:");
console.log("   " + maskedUri);
console.log("");

// Check for common issues
let issues = [];
let warnings = [];

// Check 1: Missing database name
if (!mongodbUri.includes("/peerly") && !mongodbUri.includes("/?") && !mongodbUri.endsWith("/")) {
  if (!mongodbUri.match(/\/[^\/\?]+(\?|$)/)) {
    issues.push("Missing database name. Should have /peerly before ?");
  }
} else if (mongodbUri.includes("/?")) {
  issues.push("Missing database name. Connection string has /? instead of /peerly?");
}

// Check 2: Wrong query parameters
if (mongodbUri.includes("appName=DB")) {
  issues.push("Wrong query parameters. Has ?appName=DB instead of ?retryWrites=true&w=majority");
}

if (!mongodbUri.includes("retryWrites=true")) {
  warnings.push("Missing retryWrites=true in query parameters");
}

if (!mongodbUri.includes("w=majority")) {
  warnings.push("Missing w=majority in query parameters");
}

// Check 3: Format issues
if (mongodbUri.includes(" ")) {
  issues.push("Connection string contains spaces (remove them)");
}

if (mongodbUri.startsWith('"') || mongodbUri.startsWith("'")) {
  issues.push("Connection string has quotes (remove quotes from .env file)");
}

if (mongodbUri.endsWith('"') || mongodbUri.endsWith("'")) {
  issues.push("Connection string has quotes (remove quotes from .env file)");
}

// Check 4: Check if it's SRV format
if (!mongodbUri.startsWith("mongodb+srv://")) {
  warnings.push("Not using SRV format (mongodb+srv://). This is okay but SRV is recommended for Atlas");
}

// Display results
if (issues.length === 0 && warnings.length === 0) {
  console.log("✅ Connection string format looks correct!\n");
  
  // Extract database name
  const dbMatch = mongodbUri.match(/mongodb\+srv:\/\/[^\/]+\/([^?]+)/);
  if (dbMatch) {
    console.log("📊 Database name:", dbMatch[1]);
  }
  
  console.log("\n💡 If you're still getting connection errors:");
  console.log("   1. Verify IP is whitelisted in Atlas (wait 2 minutes)");
  console.log("   2. Check username/password are correct");
  console.log("   3. Flush DNS: ipconfig /flushdns");
  console.log("   4. Verify cluster is running in Atlas\n");
} else {
  if (issues.length > 0) {
    console.log("❌ Issues Found:\n");
    issues.forEach((issue, i) => {
      console.log(`   ${i + 1}. ${issue}`);
    });
    console.log("");
  }
  
  if (warnings.length > 0) {
    console.log("⚠️  Warnings:\n");
    warnings.forEach((warning, i) => {
      console.log(`   ${i + 1}. ${warning}`);
    });
    console.log("");
  }
  
  console.log("🔧 Correct Format:");
  console.log("   MONGODB_URI=mongodb+srv://admin:admin@db.jmrmhg3.mongodb.net/peerly?retryWrites=true&w=majority");
  console.log("");
  console.log("📝 Steps to Fix:");
  console.log("   1. Open your .env file");
  console.log("   2. Find the MONGODB_URI line");
  console.log("   3. Replace with the correct format above");
  console.log("   4. Save the file");
  console.log("   5. Run this script again to verify\n");
}

// Check other required variables
console.log("📋 Other Environment Variables:");
const requiredVars = ["JWT_SECRET", "PORT"];
requiredVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`   ✅ ${varName}: ${varName === "JWT_SECRET" ? "***" : value}`);
  } else {
    console.log(`   ❌ ${varName}: Not set`);
  }
});

console.log("");
