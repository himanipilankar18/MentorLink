const mongoose = require('mongoose');

/**
 * Connect to MongoDB (Atlas or local).
 * Auto-retries with alternate shard node if "not primary" or connection fails.
 */
const connectDB = async () => {
  let uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('MONGODB_URI is not set in .env');
    process.exit(1);
  }

  const options = {
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
    maxPoolSize: 10,
    tls: true,
  };

  if (process.env.ATLAS_TLS_INSECURE === '1') {
    options.tlsAllowInvalidCertificates = true;
  }

  const urisToTry = [uri];
  if (uri.includes('shard-00-00')) {
    urisToTry.push(uri.replace('shard-00-00', 'shard-00-01'));
    urisToTry.push(uri.replace('shard-00-00', 'shard-00-02'));
  } else if (uri.includes('shard-00-01')) {
    urisToTry.push(uri.replace('shard-00-01', 'shard-00-00'));
    urisToTry.push(uri.replace('shard-00-01', 'shard-00-02'));
  } else if (uri.includes('shard-00-02')) {
    urisToTry.push(uri.replace('shard-00-02', 'shard-00-00'));
    urisToTry.push(uri.replace('shard-00-02', 'shard-00-01'));
  }

  let lastError;
  for (const tryUri of urisToTry) {
    try {
      const conn = await mongoose.connect(tryUri, options);
      console.log(`MongoDB Connected: ${conn.connection.host}`);
      return conn;
    } catch (error) {
      lastError = error;
      if (error.message && (error.message.includes('not primary') || error.message.includes('MongoNetworkError'))) {
        console.warn(`Retrying with alternate node...`);
        continue;
      }
      break;
    }
  }

  const error = lastError || new Error('Unknown connection failure');
  console.error('\n========== FULL MongoDB Error (for debugging) ==========');
    console.error('Message:', error.message);
    console.error('Name:', error.name);
    if (error.reason) console.error('Reason:', error.reason);
    if (error.code) console.error('Code:', error.code);
    console.error('\nFull error object:');
    console.error(error);
    console.error('========== End MongoDB Error ==========\n');

    const isQuerySrvTimeout = error.syscall === 'querySrv' || (error.message && error.message.includes('querySrv'));
    const isReplicaSetNoPrimary = error.reason && typeof error.reason === 'object'
      && error.reason.type === 'ReplicaSetNoPrimary'
      && error.reason.servers;
    const allUnknown = isReplicaSetNoPrimary && error.reason.servers
      && [...error.reason.servers.values()].every((s) => s.type === 'Unknown' && s.roundTripTime === -1);

    if (isQuerySrvTimeout) {
      console.error('🔴 querySrv ETIMEOUT = DNS cannot resolve MongoDB Atlas SRV record.');
      console.error('   Fix: use the STANDARD (non-SRV) connection string so DNS SRV is not needed.');
      console.error('');
      console.error('   In .env, replace MONGODB_URI with (use your real username/password):');
      console.error('   MONGODB_URI=mongodb://USER:PASS@ac-lycijz6-shard-00-00.jmrmhg3.mongodb.net:27017,ac-lycijz6-shard-00-01.jmrmhg3.mongodb.net:27017,ac-lycijz6-shard-00-02.jmrmhg3.mongodb.net:27017/peerly?ssl=true&replicaSet=atlas-lycijz6-shard-0&authSource=admin&retryWrites=true&w=majority');
      console.error('');
      console.error('   See DNS_SRV_FIX.md for details.');
    } else if (allUnknown) {
      console.error('🔴 TCP works but driver still fails → likely TLS handshake or authentication.');
      console.error('');
      console.error('   Try in this order:');
      console.error('   1. Connection string: correct username/password; special chars URL-encoded (@→%40, #→%23).');
      console.error('   2. Add authSource if user is in admin DB:');
      console.error('      MONGODB_URI=mongodb+srv://user:pass@host/peerly?retryWrites=true&w=majority&authSource=admin');
      console.error('   3. Test TLS bypass (dev only): in .env add  ATLAS_TLS_INSECURE=1  then run again.');
      console.error('   4. In Atlas: Database Access → user has "Atlas admin" or "Read and write to any database".');
      console.error('');
      console.error('   See TLS_AUTH_FIX.md for details.');
    } else if (error.message && error.message.toLowerCase().includes('whitelist')) {
      console.error('🔴 IP NOT WHITELISTED: Add your IP in MongoDB Atlas → Network Access → Add Current IP Address');
      console.error('   https://cloud.mongodb.com → Project → Network Access → IP Access List');
    } else {
      console.error('💡 Common causes:');
      console.error('   - IP not whitelisted in Atlas → Network Access');
      console.error('   - Wrong username/password; special chars URL-encoded (@→%40, #→%23)');
      console.error('   - Database name /mentorlink before ? in URI');
      console.error('   - Add authSource=admin if user is in admin database');
    }
  process.exit(1);
};

module.exports = connectDB;
