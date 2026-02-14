const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');
const { validateRegistration, validateLogin, handleValidationErrors, validateEmailDomain } = require('../middleware/validation');
const { authLimiter } = require('../middleware/security');

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

      // Create user
      const user = await User.create({
        name,
        email,
        password,
        year,
        department,
        role,
        skills: skills || [],
        interests: interests || [],
        cgpa: cgpa || null
      });

      // Generate token
      const token = generateToken(user._id);

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
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

      // Check if user exists and get password
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

module.exports = router;
