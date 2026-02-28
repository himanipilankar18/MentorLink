require('dotenv').config();

const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { securityHeaders, apiLimiter } = require('./middleware/security');

const app = express();

// Security middleware
app.use(securityHeaders);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check - BEFORE rate limiting so Check Connection always works
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'MentorLink API is running',
    timestamp: new Date().toISOString(),
  });
});

// Rate limiting for API routes
app.use('/api/', apiLimiter);

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/mentorship', require('./routes/mentorship'));
app.use('/api/interactions', require('./routes/interactions'));
app.use('/api/discussions', require('./routes/discussions'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/communities', require('./routes/communities'));

// Serve uploaded profile images
app.use('/uploads', express.static('uploads'));

// Serve static files (frontend dashboard) - after API routes
app.use(express.static('public'));

// Handle favicon.ico requests gracefully
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// Root API info (for clients hitting / directly)
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to MentorLink API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      mentorship: '/api/mentorship',
      interactions: '/api/interactions',
      discussions: '/api/discussions',
    },
  });
});

// Error handling middleware (must be last)
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

/**
 * Start server only AFTER MongoDB is connected.
 * This prevents "Server running" before DB is ready and surfaces the real error.
 */
async function startServer() {
  try {
    console.log('Connecting to MongoDB...');

    await connectDB();

    console.log('MongoDB Connected Successfully');

    app.listen(PORT, () => {
      console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    });
  } catch (error) {
    console.error('FULL MongoDB Error:');
    console.error(error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
