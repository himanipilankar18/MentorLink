const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { verifyToken, checkRole } = require('../middleware/auth');
const { validateRegistration, validateLogin, handleValidationErrors, validateEmailDomain } = require('../middleware/validation');
const { authLimiter } = require('../middleware/security');
const sendEmail = require('../utils/sendEmail');

const router = express.Router();

// Security: Whitelist of roles allowed for public registration
// Admin role can only be created through protected endpoint
const ALLOWED_REGISTRATION_ROLES = ['junior', 'senior', 'faculty'];

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

      // No year/role restrictions - anyone with SPIT email can register
      // (including alumni, faculty, etc.)

      // Security: Sanitize role - only allow whitelisted roles for public registration
      // Admin role can only be created through protected /create-admin endpoint
      const sanitizedRole = ALLOWED_REGISTRATION_ROLES.includes(role) ? role : 'junior';

      // Create user (unverified initially)
      const user = await User.create({
        name,
        email,
        password,
        year,
        department,
        role: sanitizedRole,
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

// @route   POST /api/auth/create-admin
// @desc    Create a new admin user (protected endpoint - only existing admins can create new admins)
// @access  Private (Admin only)
router.post('/create-admin',
  verifyToken,
  checkRole('admin'),
  async (req, res) => {
    try {
      const { name, email, password, department } = req.body;

      // Validate required fields
      if (!name || !email || !password || !department) {
        return res.status(400).json({
          success: false,
          message: 'Please provide name, email, password, and department'
        });
      }

      // Validate email domain (must be SPIT email)
      if (!email.endsWith('@spit.ac.in')) {
        return res.status(400).json({
          success: false,
          message: 'Admin must have a valid SPIT email address'
        });
      }

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this email already exists'
        });
      }

      // Create admin user (auto-verified)
      const admin = await User.create({
        name,
        email,
        password,
        department,
        role: 'admin',
        isVerified: true,
        profileComplete: true
      });

      // Send welcome email to new admin
      const html = `
        <h2>Welcome to MentorLink Admin Team</h2>
        <p>Hello ${admin.name},</p>
        <p>An admin account has been created for you on MentorLink with the following credentials:</p>
        <ul>
          <li><strong>Email:</strong> ${admin.email}</li>
          <li><strong>Role:</strong> Administrator</li>
        </ul>
        <p><strong>⚠️ IMPORTANT:</strong> Please log in and change your password immediately for security reasons.</p>
        <p>As an admin, you have full access to the system and can manage users, mentorships, and create other admin accounts.</p>
        <p>Login at: <a href="${process.env.APP_URL || 'http://localhost:5000'}/login.html">${process.env.APP_URL || 'http://localhost:5000'}/login.html</a></p>
      `;

      sendEmail({ 
        to: admin.email, 
        subject: 'MentorLink Admin Account Created', 
        html 
      }).catch(console.error);

      res.status(201).json({
        success: true,
        message: 'Admin user created successfully',
        admin: {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
          department: admin.department
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error creating admin user',
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

      // Send login notification email
      const loginTime = new Date().toLocaleString('en-IN', { 
        timeZone: 'Asia/Kolkata',
        dateStyle: 'full',
        timeStyle: 'short'
      });

      const loginHtml = `
        <h2>New Login to Your MentorLink Account</h2>
        <p>Hello ${user.name},</p>
        <p>We detected a login to your MentorLink account:</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Time:</strong> ${loginTime}</p>
          <p style="margin: 5px 0;"><strong>Email:</strong> ${user.email}</p>
        </div>
        <p>If this was you, you can safely ignore this email.</p>
        <p><strong>If this wasn't you, please reset your password immediately and contact support.</strong></p>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e0e0e0;">
        <p style="color: #666; font-size: 0.9em;">This is an automated security notification from MentorLink.</p>
      `;

      sendEmail({ 
        to: user.email, 
        subject: 'New Login to Your MentorLink Account', 
        html: loginHtml 
      }).catch(console.error);

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
        bio: user.bio,
        projects: user.projects,
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

      // Send welcome email
      const welcomeHtml = `
        <h2>Welcome to MentorLink! 🎉</h2>
        <p>Hello ${user.name},</p>
        <p>Your email has been successfully verified! Welcome to the MentorLink community at SPIT.</p>
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px; color: white; margin: 20px 0;">
          <h3 style="margin: 0 0 10px 0; color: white;">What's Next?</h3>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li style="margin: 8px 0;">Complete your profile with your skills and interests</li>
            <li style="margin: 8px 0;">Connect with mentors in your field</li>
            <li style="margin: 8px 0;">Join discussions and share knowledge</li>
            <li style="margin: 8px 0;">Track your academic progress</li>
          </ul>
        </div>
        <p><a href="${process.env.BACKEND_BASE_URL || 'http://localhost:5000'}/login.html" style="display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0;">Login to Your Account</a></p>
        <p>If you have any questions, feel free to reach out to our support team.</p>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e0e0e0;">
        <p style="color: #666; font-size: 0.9em;">You're receiving this email because you registered for MentorLink at SPIT.</p>
      `;

      sendEmail({ 
        to: user.email, 
        subject: 'Welcome to MentorLink! 🎓', 
        html: welcomeHtml 
      }).catch(console.error);

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

// @route   POST /api/auth/forgot-password
// @desc    Send password reset email
// @access  Public
router.post('/forgot-password',
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

      // Find user
      const user = await User.findOne({ email: email.toLowerCase() });

      if (!user) {
        // Don't reveal if user exists or not for security
        return res.json({
          success: true,
          message: 'If an account with that email exists, a password reset link has been sent.'
        });
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
      
      user.resetPasswordToken = hashedToken;
      user.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour
      await user.save();

      const backendBase = process.env.BACKEND_BASE_URL || 'http://localhost:5000';
      const resetUrl = `${backendBase}/reset-password.html?token=${resetToken}`;

      const html = `
        <h2>Reset Your MentorLink Password</h2>
        <p>Hello ${user.name},</p>
        <p>You requested to reset your password. Click the link below to set a new password:</p>
        <p><a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
        <p>Or copy and paste this URL into your browser:</p>
        <p>${resetUrl}</p>
        <p><strong>This link will expire in 1 hour.</strong></p>
        <p>If you didn't request this, please ignore this email.</p>
      `;

      // Send email
      sendEmail({ to: user.email, subject: 'MentorLink - Password Reset Request', html }).catch(console.error);

      res.json({
        success: true,
        message: 'Password reset link has been sent to your email'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to process password reset request',
        error: error.message
      });
    }
  }
);

// @route   POST /api/auth/reset-password
// @desc    Reset password using token
// @access  Public
router.post('/reset-password',
  authLimiter,
  async (req, res) => {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        return res.status(400).json({
          success: false,
          message: 'Token and new password are required'
        });
      }

      // Validate password
      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters'
        });
      }

      // Hash token and find user
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
      const user = await User.findOne({
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { $gt: Date.now() }
      }).select('+password');

      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired reset token'
        });
      }

      // Update password
      user.password = password;
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;
      await user.save();

      // Send password change confirmation email
      const changeTime = new Date().toLocaleString('en-IN', { 
        timeZone: 'Asia/Kolkata',
        dateStyle: 'full',
        timeStyle: 'short'
      });

      const passwordChangeHtml = `
        <h2>Password Changed Successfully</h2>
        <p>Hello ${user.name},</p>
        <p>Your MentorLink password was successfully changed.</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Time:</strong> ${changeTime}</p>
          <p style="margin: 5px 0;"><strong>Account:</strong> ${user.email}</p>
        </div>
        <p>You can now login with your new password.</p>
        <p><strong>If you didn't make this change, please contact support immediately.</strong></p>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e0e0e0;">
        <p style="color: #666; font-size: 0.9em;">This is an automated security notification from MentorLink.</p>
      `;

      sendEmail({ 
        to: user.email, 
        subject: 'Your MentorLink Password Was Changed', 
        html: passwordChangeHtml 
      }).catch(console.error);

      res.json({
        success: true,
        message: 'Password reset successful! You can now login with your new password.'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to reset password',
        error: error.message
      });
    }
  }
);

module.exports = router;
