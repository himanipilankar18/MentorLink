/**
 * Quick script to generate a secure JWT secret
 * Run: node generate-jwt-secret.js
 */

const crypto = require('crypto');

// Generate a 64-byte (512-bit) random secret
const secret = crypto.randomBytes(64).toString('hex');

console.log('\n🔐 Generated JWT Secret:');
console.log('='.repeat(80));
console.log(secret);
console.log('='.repeat(80));
console.log('\n📋 Copy this value to your .env file as JWT_SECRET');
console.log('⚠️  Keep this secret secure and never commit it to version control!\n');
