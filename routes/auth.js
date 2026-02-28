const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');
const { validateRegistration, validateLogin, handleValidationErrors, validateEmailDomain } = require('../middleware/validation');
const { authLimiter } = require('../middleware/security');
const sendEmail = require('../utils/sendEmail');

const router = express.Router();

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', 
  authLimiter,
  validateEmailDomain(process.env.ALLOWED_DOMAINS || 'spit.ac.in'),
  validateRegistration,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { name, email, password, year, department, role, skills, interests, cgpa } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User already exists with this email'
        });
      }

      // Validate role constraints
      if (role === 'junior' && year >= 3) {
        return res.status(400).json({
          success: false,
          message: 'Juniors must be in year 1 or 2'
        });
      }

      if (role === 'senior' && year < 3) {
        return res.status(400).json({
          success: false,
          message: 'Seniors must be in year 3 or 4'
        });
      }

      // Create user (unverified initially)
      const user = await User.create({
        name,
        email,
        password,
        year,
        department,
        role,
        skills: skills || [],
        interests: interests || [],
        cgpa: cgpa || null,
        isVerified: false
      });

      // Generate email verification token (store hashed)
      const rawToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
      user.emailVerificationToken = hashedToken;
      user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
      await user.save();

      const backendBase = process.env.BACKEND_BASE_URL || 'http://localhost:5000';
      const verifyUrl = `${backendBase}/api/auth/verify-email?token=${rawToken}`;

      const html = `
        <h2>Verify your MentorLink account</h2>
        <p>Hello ${user.name || ''},</p>
        <p>Thank you for registering on MentorLink. Please verify that this is your official SPIT email by clicking the link below:</p>
        <p><a href="${verifyUrl}" target="_blank">Verify Email</a></p>
        <p>This link will expire in 24 hours.</p>
      `;

      // Fire-and-forget email (logs to console if SMTP not configured)
      sendEmail({ to: user.email, subject: 'Verify your MentorLink email', html }).catch(console.error);

      res.status(201).json({
        success: true,
        message: 'User registered successfully. Please check your SPIT email to verify your account.',
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          year: user.year,
          department: user.department,
          role: user.role,
          skills: user.skills,
          interests: user.interests,
          cgpa: user.cgpa
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Registration failed',
        error: error.message
      });
    }
  }
);

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login',
  authLimiter,
  validateLogin,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { email, password } = req.body;

      // Check if user exists and get password + verification fields
      const user = await User.findOne({ email }).select('+password');
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Check if account is active
      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Account is deactivated. Please contact administrator.'
        });
      }

      // Block login until email is verified
      if (!user.isVerified) {
        return res.status(403).json({
          success: false,
          message: 'Email not verified. Please check your SPIT inbox for the verification link.'
        });
      }

      // Verify password
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Generate token
      const token = generateToken(user._id);

      res.json({
        success: true,
        message: 'Login successful',
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          year: user.year,
          department: user.department,
          role: user.role,
          skills: user.skills,
          interests: user.interests,
          cgpa: user.cgpa
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Login failed',
        error: error.message
      });
    }
  }
);

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        year: user.year,
        department: user.department,
        role: user.role,
        skills: user.skills,
        interests: user.interests,
        cgpa: user.cgpa,
        isVerified: user.isVerified,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user',
      error: error.message
    });
  }
});

// @route   GET /api/auth/verify-email?token=...
// @desc    Verify email using emailed token
// @access  Public
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Verification token is required'
      });
    }

    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      emailVerificationToken: hashed,
      emailVerificationExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token'
      });
    }

    user.isVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save();

    return res.json({
      success: true,
      message: 'Email verified successfully. You can now log in.'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Email verification failed',
      error: error.message
    });
  }
});

module.exports = router;
