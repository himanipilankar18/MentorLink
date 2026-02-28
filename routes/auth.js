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

      // Generate 6-digit OTP for email verification
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      user.emailVerificationOTP = otp;
      user.otpExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
      await user.save();

      const html = `
        <h2>Verify your MentorLink account</h2>
        <p>Hello ${user.name || ''},</p>
        <p>Thank you for registering on MentorLink. Please verify that this is your official SPIT email by entering the OTP below:</p>
        <h1 style="color: #4F46E5; font-size: 32px; letter-spacing: 5px; font-family: monospace;">${otp}</h1>
        <p><strong>This OTP will expire in 15 minutes.</strong></p>
        <p>If you did not request this, please ignore this email.</p>
      `;

      // Fire-and-forget email (logs to console if SMTP not configured)
      sendEmail({ to: user.email, subject: 'Verify your MentorLink email', html }).catch(console.error);

      res.status(201).json({
        success: true,
        message: 'User registered successfully. Please check your SPIT email for a 6-digit OTP to verify your account.',
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
          message: 'Email not verified. Please check your SPIT inbox for the OTP and verify your account.'
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

// @route   GET /api/auth/verify-email
// @desc    Verify email using emailed token (legacy - keep for backwards compatibility)
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

// @route   POST /api/auth/verify-otp
// @desc    Verify email using OTP sent to email
// @access  Public
router.post('/verify-otp',
  authLimiter,
  async (req, res) => {
    try {
      const { email, otp } = req.body;

      // Validate input
      if (!email || !otp) {
        return res.status(400).json({
          success: false,
          message: 'Email and OTP are required'
        });
      }

      // Find user with matching OTP that hasn't expired
      const user = await User.findOne({
        email: email.toLowerCase(),
        emailVerificationOTP: otp,
        otpExpires: { $gt: Date.now() }
      }).select('+emailVerificationOTP +otpExpires');

      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired OTP. Please request a new one.'
        });
      }

      // Verify user and clear OTP
      user.isVerified = true;
      user.emailVerificationOTP = null;
      user.otpExpires = null;
      await user.save();

      return res.json({
        success: true,
        message: 'Email verified successfully! You can now log in.'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'OTP verification failed',
        error: error.message
      });
    }
  }
);

// @route   POST /api/auth/resend-otp
// @desc    Resend OTP to user's email
// @access  Public
router.post('/resend-otp',
  authLimiter,
  async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email is required'
        });
      }

      // Find unverified user
      const user = await User.findOne({
        email: email.toLowerCase(),
        isVerified: false
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found or already verified'
        });
      }

      // Generate new OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      user.emailVerificationOTP = otp;
      user.otpExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
      await user.save();

      const html = `
        <h2>Verify your MentorLink account</h2>
        <p>Hello ${user.name || ''},</p>
        <p>Here is your new OTP to verify your SPIT email:</p>
        <h1 style="color: #4F46E5; font-size: 32px; letter-spacing: 5px; font-family: monospace;">${otp}</h1>
        <p><strong>This OTP will expire in 15 minutes.</strong></p>
        <p>If you did not request this, please ignore this email.</p>
      `;

      // Send email
      sendEmail({ to: user.email, subject: 'MentorLink - New OTP', html }).catch(console.error);

      res.json({
        success: true,
        message: 'OTP has been resent to your email'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to resend OTP',
        error: error.message
      });
    }
  }
);

module.exports = router;
