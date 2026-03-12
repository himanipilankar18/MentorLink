const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const { verifyToken, checkRole } = require('../middleware/auth');
const { validateRegistration, validateLogin, handleValidationErrors, validateEmailDomain } = require('../middleware/validation');
const { authLimiter } = require('../middleware/security');
const sendEmail = require('../utils/sendEmail');

const router = express.Router();

// Temporary storage for pending registrations (before OTP verification)
// In production, use Redis or a separate PendingUsers collection
const pendingRegistrations = new Map();

// Cleanup expired pending registrations every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [email, data] of pendingRegistrations.entries()) {
    if (data.otpExpires < now) {
      pendingRegistrations.delete(email);
      console.log(`Cleaned up expired pending registration for: ${email}`);
    }
  }
}, 5 * 60 * 1000); // 5 minutes

// Configure multer for profile picture uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'public/uploads/profiles';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
  }
});

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
// @desc    Register a new user (Step 1: Basic info only)
// @access  Public
router.post('/register', 
  authLimiter,
  validateEmailDomain(process.env.ALLOWED_DOMAINS || 'spit.ac.in'),
  async (req, res) => {
    try {
      const { name, email, year, branch, role } = req.body;

      // Validate required fields
      if (!name || !email || !year || !branch) {
        return res.status(400).json({
          success: false,
          message: 'Please provide name, email, year, and branch'
        });
      }

      // Check if user already exists
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User already exists with this email'
        });
      }

      // Check if there's a pending registration for this email
      if (pendingRegistrations.has(email.toLowerCase())) {
        return res.status(400).json({
          success: false,
          message: 'A registration is already pending for this email. Please check your email for the OTP or wait for it to expire.'
        });
      }

      // Auto-detect role based on year: 1-2 = junior, 3-4 = senior
      const sanitizedRole = ALLOWED_REGISTRATION_ROLES.includes(role) ? role : 'junior';

      // Generate 6-digit OTP for email verification
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpires = Date.now() + 15 * 60 * 1000; // 15 minutes

      // Store user data temporarily (NOT in database yet)
      pendingRegistrations.set(email.toLowerCase(), {
        name,
        email: email.toLowerCase(),
        year,
        department: branch,
        role: sanitizedRole,
        otp,
        otpExpires,
        createdAt: Date.now()
      });

      const html = `
        <h2>Verify your MentorLink account</h2>
        <p>Hello ${name || ''},</p>
        <p>Thank you for registering on MentorLink. Please verify that this is your official SPIT email by entering the OTP below:</p>
        <h1 style="color: #4F46E5; font-size: 32px; letter-spacing: 5px; font-family: monospace;">${otp}</h1>
        <p><strong>This OTP will expire in 15 minutes.</strong></p>
        <p>If you did not request this, please ignore this email.</p>
      `;

      // Send email with better error handling
      console.log(`📧 Sending OTP to ${email.toLowerCase()}, OTP: ${otp}`);
      try {
        await sendEmail({ to: email.toLowerCase(), subject: 'Verify your MentorLink email', html });
        console.log(`✅ OTP email sent successfully to ${email.toLowerCase()}`);
      } catch (emailError) {
        console.error(`❌ Failed to send OTP email to ${email.toLowerCase()}:`, emailError);
        // Clear pending registration if email fails
        pendingRegistrations.delete(email.toLowerCase());
        return res.status(500).json({
          success: false,
          message: 'Failed to send verification email. Please try again.'
        });
      }

      res.status(200).json({
        success: true,
        message: 'OTP sent successfully. Please check your SPIT email for verification.',
        email: email.toLowerCase()
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

      // Block login until profile is completed
      if (!user.profileComplete) {
        return res.status(403).json({
          success: false,
          message: 'Profile not completed. Please complete your profile setup to continue.'
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
        projectLink: user.projectLink,
        profilePicture: user.profilePicture,
        githubUrl: user.githubUrl,
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
        followers: user.followers || [],
        following: user.following || [],
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

      // Look up pending registration
      const pendingUser = pendingRegistrations.get(email.toLowerCase());
      
      if (!pendingUser) {
        return res.status(400).json({
          success: false,
          message: 'No pending registration found for this email. Please register first.'
        });
      }

      // Check if OTP is valid and not expired
      if (pendingUser.otp !== otp) {
        return res.status(400).json({
          success: false,
          message: 'Invalid OTP. Please try again.'
        });
      }

      if (pendingUser.otpExpires < Date.now()) {
        pendingRegistrations.delete(email.toLowerCase());
        return res.status(400).json({
          success: false,
          message: 'OTP has expired. Please register again.'
        });
      }

      // OTP verified! Now create the user in database
      const user = new User({
        name: pendingUser.name,
        email: pendingUser.email,
        year: pendingUser.year,
        department: pendingUser.department,
        role: pendingUser.role,
        isVerified: true,
        profileComplete: false
      });

      await user.save({ validateBeforeSave: false }); // Skip password validation

      // Clear pending registration
      pendingRegistrations.delete(email.toLowerCase());

      // Send welcome email
      const welcomeHtml = `
        <h2>Welcome to MentorLink! 🎉</h2>
        <p>Hello ${user.name},</p>
        <p>Your email has been successfully verified! Welcome to the MentorLink community at SPIT.</p>
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px; color: white; margin: 20px 0;">
          <h3 style="margin: 0 0 10px 0; color: white;">What's Next?</h3>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li style="margin: 8px 0;">Complete your profile with password and interests</li>
            <li style="margin: 8px 0;">Upload your profile picture</li>
            <li style="margin: 8px 0;">Connect with peers and mentors</li>
            <li style="margin: 8px 0;">Join discussions and share projects</li>
          </ul>
        </div>
        <p><a href="${process.env.BACKEND_BASE_URL || 'http://localhost:5000'}/profile-setup.html" style="display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0;">Complete Your Profile</a></p>
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
        message: 'Email verified successfully! Please complete your profile.',
        user: {
          id: user._id,
          name: user.name,
          email: user.email
        }
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

// @route   POST /api/auth/complete-profile
// @desc    Complete user profile after email verification (Step 2)
// @access  Public (requires verified email)
router.post('/complete-profile',
  authLimiter,
  upload.single('profilePicture'),
  async (req, res) => {
    try {
      const { 
        email, 
        password, 
        firstName,
        lastName,
        displayName,
        bio, 
        interests, 
        skills, 
        projects, 
        cgpa, 
        projectLink,
        githubUrl,
        skipProfile 
      } = req.body;

      // Validate required fields
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
      }

      // Validate password strength
      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters long'
        });
      }

      // Check if password contains uppercase, lowercase, and number
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
      if (!passwordRegex.test(password)) {
        return res.status(400).json({
          success: false,
          message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
        });
      }

      // Find user by email
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Check if email is verified
      if (!user.isVerified) {
        return res.status(403).json({
          success: false,
          message: 'Please verify your email first'
        });
      }

      // Check if profile already complete
      if (user.profileComplete) {
        return res.status(400).json({
          success: false,
          message: 'Profile already completed'
        });
      }

      // Update user profile
      user.password = password;
      user.profileComplete = true;

      // Add optional fields only if not skipping
      if (skipProfile !== 'true') {
        if (firstName) user.firstName = firstName;
        if (lastName) user.lastName = lastName;
        if (displayName) user.displayName = displayName;
        if (bio) user.bio = bio;
        if (projectLink) user.projectLink = projectLink;
        if (githubUrl) user.githubUrl = githubUrl;
        
        // Parse JSON arrays from FormData
        if (interests) {
          try {
            user.interests = JSON.parse(interests);
          } catch (e) {
            user.interests = interests.split(',').map(s => s.trim()).filter(s => s);
          }
        }
        
        if (skills) {
          try {
            user.skills = JSON.parse(skills);
          } catch (e) {
            user.skills = skills.split(',').map(s => s.trim()).filter(s => s);
          }
        }
        
        if (projects) {
          try {
            const projectList = JSON.parse(projects);
            user.projects = projectList.map(p => ({
              title: p,
              description: '',
              technologies: []
            }));
          } catch (e) {
            const projectList = projects.split(',').map(s => s.trim()).filter(s => s);
            user.projects = projectList.map(p => ({
              title: p,
              description: '',
              technologies: []
            }));
          }
        }
        
        if (cgpa) user.cgpa = parseFloat(cgpa);
      }

      // Handle profile picture upload
      if (req.file) {
        user.profilePicture = `/uploads/profiles/${req.file.filename}`;
      }

      await user.save();

      // Send welcome email after profile completion
      const welcomeHtml = `
        <h2>Welcome to MentorLink! 🎉</h2>
        <p>Hello ${user.name},</p>
        <p>Your profile has been successfully completed! Welcome to the MentorLink community at SPIT.</p>
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px; color: white; margin: 20px 0;">
          <h3 style="margin: 0 0 10px 0; color: white;">What's Next?</h3>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li style="margin: 8px 0;">Connect with mentors in your field</li>
            <li style="margin: 8px 0;">Join discussions and share knowledge</li>
            <li style="margin: 8px 0;">Track your academic progress</li>
            <li style="margin: 8px 0;">Build your professional network</li>
          </ul>
        </div>
        <p><a href="${process.env.BACKEND_BASE_URL || 'http://localhost:5000'}/login.html" style="display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0;">Login to Your Account</a></p>
        <p>If you have any questions, feel free to reach out to our support team.</p>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e0e0e0;">
        <p style="color: #666; font-size: 0.9em;">You're receiving this email because you completed your MentorLink profile at SPIT.</p>
      `;

      sendEmail({ 
        to: user.email, 
        subject: 'Welcome to MentorLink! 🎓', 
        html: welcomeHtml 
      }).catch(console.error);

      // Generate token to automatically log in the user
      const token = generateToken(user._id);

      return res.json({
        success: true,
        message: 'Profile completed successfully! You can now log in.',
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          year: user.year,
          department: user.department,
          role: user.role,
          profilePicture: user.profilePicture
        }
      });
    } catch (error) {
      console.error('Complete profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to complete profile',
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
