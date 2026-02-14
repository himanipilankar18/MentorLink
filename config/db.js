const mongoose = require('mongoose');

/**
 * Connect to MongoDB Atlas. Server should await this before calling app.listen().
 */
const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('MONGODB_URI is not set in .env');
    process.exit(1);
  }

  const options = {
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 10,
  };

  try {
    const conn = await mongoose.connect(uri, options);
    console.log('MongoDB Atlas Connected Successfully');
    return conn;
  } catch (error) {
    console.error('\n========== FULL MongoDB Error (for debugging) ==========');
    console.error('Message:', error.message);
    console.error('Name:', error.name);
    if (error.reason) console.error('Reason:', error.reason);
    if (error.code) console.error('Code:', error.code);
    console.error('\nFull error object:');
    console.error(error);
    console.error('========== End MongoDB Error ==========\n');
    process.exit(1);
  }
};

module.exports = connectDB;
