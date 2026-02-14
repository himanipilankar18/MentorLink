/**
 * Check if your machine can reach MongoDB Atlas on port 27017 (TCP).
 * Run: node scripts/check-atlas-reachability.js
 *
 * If this fails, your network or firewall is blocking MongoDB (same as the app error).
 */

const net = require('net');

// One of the replica set hosts from your error (from db.jmrmhg3.mongodb.net SRV)
const HOST = 'ac-lycijz6-shard-00-00.jmrmhg3.mongodb.net';
const PORT = 27017;
const TIMEOUT_MS = 8000;

console.log('\n🔍 Checking TCP reachability to MongoDB Atlas...');
console.log(`   Host: ${HOST}`);
console.log(`   Port: ${PORT}`);
console.log(`   Timeout: ${TIMEOUT_MS}ms\n`);

const socket = new net.Socket();
let resolved = false;

const done = (ok, msg) => {
  if (resolved) return;
  resolved = true;
  socket.destroy();
  if (ok) {
    console.log('✅ TCP connection to Atlas succeeded.');
    console.log('   So the issue is likely TLS/auth or app config, not firewall.\n');
  } else {
    console.log('❌ TCP connection to Atlas failed.');
    console.log('   ', msg);
    console.log('\n💡 Your network or firewall is blocking outbound port 27017.');
    console.log('   Try: allow Node.js in firewall, use mobile hotspot, or different network.\n');
  }
  process.exit(ok ? 0 : 1);
};

socket.setTimeout(TIMEOUT_MS);
socket.on('connect', () => done(true));
socket.on('timeout', () => done(false, 'Connection timed out.'));
socket.on('error', (err) => done(false, err.message));

socket.connect(PORT, HOST);
