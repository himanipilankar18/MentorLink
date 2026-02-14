const { body, validationResult } = require('express-validator');

// Handle validation errors
exports.handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// Email domain validation
exports.validateEmailDomain = (allowedDomains) => {
  return (req, res, next) => {
    const email = req.body.email;
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const domains = allowedDomains.split(',').map(d => d.trim());
    const emailDomain = email.split('@')[1];

    if (!domains.includes(emailDomain)) {
      return res.status(400).json({
        success: false,
        message: `Email domain must be one of: ${domains.join(', ')}`
      });
    }

    next();
  };
};

// Registration validation rules
exports.validateRegistration = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ max: 100 }).withMessage('Name cannot exceed 100 characters'),
  
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('password')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  
  body('year')
    .isInt({ min: 1, max: 4 }).withMessage('Year must be between 1 and 4'),
  
  body('department')
    .trim()
    .notEmpty().withMessage('Department is required')
    .isIn(['CSE', 'IT', 'ECE', 'EEE', 'MECH', 'CIVIL', 'CHEM', 'OTHER'])
    .withMessage('Invalid department'),
  
  body('role')
    .isIn(['junior', 'senior', 'faculty', 'admin'])
    .withMessage('Role must be junior, senior, faculty, or admin'),
  
  body('skills')
    .optional()
    .isArray().withMessage('Skills must be an array')
    .custom((skills) => {
      if (!Array.isArray(skills)) return false;
      return skills.every(skill => typeof skill === 'string' && skill.trim().length > 0);
    }).withMessage('Each skill must be a non-empty string'),
  
  body('interests')
    .optional()
    .isArray().withMessage('Interests must be an array')
    .custom((interests) => {
      if (!Array.isArray(interests)) return false;
      return interests.every(interest => typeof interest === 'string' && interest.trim().length > 0);
    }).withMessage('Each interest must be a non-empty string'),
  
  body('cgpa')
    .optional()
    .isFloat({ min: 0, max: 10 }).withMessage('CGPA must be between 0 and 10')
];

// Login validation rules
exports.validateLogin = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('password')
    .notEmpty().withMessage('Password is required')
];

// Interaction validation rules
exports.validateInteraction = [
  body('mentorId')
    .notEmpty().withMessage('Mentor ID is required')
    .isMongoId().withMessage('Invalid mentor ID'),
  
  body('mentorshipId')
    .notEmpty().withMessage('Mentorship ID is required')
    .isMongoId().withMessage('Invalid mentorship ID'),
  
  body('topic')
    .trim()
    .notEmpty().withMessage('Topic is required')
    .isLength({ max: 200 }).withMessage('Topic cannot exceed 200 characters'),
  
  body('subjectTag')
    .trim()
    .notEmpty().withMessage('Subject tag is required')
    .isIn([
      'Data Structures', 'Algorithms', 'Database Systems', 'Operating Systems',
      'Computer Networks', 'Software Engineering', 'Machine Learning', 'Web Development',
      'Mobile Development', 'Cybersecurity', 'Cloud Computing', 'DevOps',
      'Mathematics', 'Physics', 'Chemistry', 'Other'
    ]).withMessage('Invalid subject tag'),
  
  body('interactionType')
    .isIn(['Chat', 'Video Call', 'In-Person', 'Email', 'Forum Discussion', 'Code Review', 'Project Guidance'])
    .withMessage('Invalid interaction type'),
  
  body('duration')
    .optional()
    .isInt({ min: 0 }).withMessage('Duration must be a non-negative integer'),
  
  body('satisfactionRating')
    .optional()
    .isInt({ min: 1, max: 5 }).withMessage('Satisfaction rating must be between 1 and 5')
];

// Discussion validation rules
exports.validateDiscussion = [
  body('title')
    .trim()
    .notEmpty().withMessage('Title is required')
    .isLength({ max: 200 }).withMessage('Title cannot exceed 200 characters'),
  
  body('content')
    .trim()
    .notEmpty().withMessage('Content is required')
    .isLength({ max: 5000 }).withMessage('Content cannot exceed 5000 characters'),
  
  body('subjectTag')
    .trim()
    .notEmpty().withMessage('Subject tag is required')
    .isIn([
      'Data Structures', 'Algorithms', 'Database Systems', 'Operating Systems',
      'Computer Networks', 'Software Engineering', 'Machine Learning', 'Web Development',
      'Mobile Development', 'Cybersecurity', 'Cloud Computing', 'DevOps',
      'Mathematics', 'Physics', 'Chemistry', 'Other'
    ]).withMessage('Invalid subject tag')
];
