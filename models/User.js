const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't return password in queries by default
  },
  year: {
    type: Number,
    required: [true, 'Year is required'],
    min: [1, 'Year must be at least 1'],
    max: [4, 'Year cannot exceed 4']
  },
  department: {
    type: String,
    required: [true, 'Department is required'],
    trim: true,
    enum: {
      values: ['CSE', 'IT', 'ECE', 'EEE', 'MECH', 'CIVIL', 'CHEM', 'OTHER'],
      message: 'Invalid department'
    }
  },
  role: {
    type: String,
    required: [true, 'Role is required'],
    enum: {
      values: ['junior', 'senior', 'faculty', 'admin'],
      message: 'Role must be junior, senior, faculty, or admin'
    }
  },
  skills: {
    type: [String],
    default: [],
    validate: {
      validator: function(v) {
        return v.every(skill => typeof skill === 'string' && skill.trim().length > 0);
      },
      message: 'Skills must be non-empty strings'
    }
  },
  interests: {
    type: [String],
    default: [],
    validate: {
      validator: function(v) {
        return v.every(interest => typeof interest === 'string' && interest.trim().length > 0);
      },
      message: 'Interests must be non-empty strings'
    }
  },
  cgpa: {
    type: Number,
    min: [0, 'CGPA cannot be negative'],
    max: [10, 'CGPA cannot exceed 10'],
    default: null
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: {
    type: String,
    default: null,
    select: false
  },
  emailVerificationExpires: {
    type: Date,
    default: null,
    select: false
  },
  emailVerificationOTP: {
    type: String,
    default: null,
    select: false
  },
  otpExpires: {
    type: Date,
    default: null,
    select: false
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true, // Automatically adds createdAt and updatedAt
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Virtual for mentor relationships
userSchema.virtual('mentorRelationships', {
  ref: 'Mentorship',
  localField: '_id',
  foreignField: 'mentorId'
});

// Virtual for mentee relationships
userSchema.virtual('menteeRelationships', {
  ref: 'Mentorship',
  localField: '_id',
  foreignField: 'menteeId'
});

module.exports = mongoose.model('User', userSchema);
