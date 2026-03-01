const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  firstName: {
    type: String,
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters'],
    default: ''
  },
  lastName: {
    type: String,
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters'],
    default: ''
  },
  nickname: {
    type: String,
    trim: true,
    maxlength: [50, 'Nickname cannot exceed 50 characters'],
    default: ''
  },
  displayName: {
    type: String,
    trim: true,
    maxlength: [100, 'Display name cannot exceed 100 characters'],
    default: ''
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  whatsapp: {
    type: String,
    trim: true,
    maxlength: [20, 'WhatsApp number cannot exceed 20 characters'],
    default: ''
  },
  telegram: {
    type: String,
    trim: true,
    maxlength: [50, 'Telegram username cannot exceed 50 characters'],
    default: ''
  },
  website: {
    type: String,
    trim: true,
    maxlength: [200, 'Website URL cannot exceed 200 characters'],
    default: ''
  },
  githubUrl: {
    type: String,
    trim: true,
    maxlength: [200, 'GitHub URL cannot exceed 200 characters'],
    default: ''
  },
  password: {
    type: String,
    required: function() {
      // Password is required only when profileComplete is true
      return this.profileComplete === true;
    },
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't return password in queries by default
  },
  year: {
    type: Number,
    required: false,
    min: [1, 'Year must be at least 1'],
    max: [5, 'Year cannot exceed 5'],
    default: null
  },
  department: {
    type: String,
    required: [true, 'Department is required'],
    trim: true,
    enum: {
      values: ['CSE', 'IT', 'ECE', 'EEE', 'MECH', 'CIVIL', 'CHEM', 'OTHER', 'COMPS', 'EXTC'],
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
  bio: {
    type: String,
    trim: true,
    maxlength: [1000, 'Bio cannot exceed 1000 characters'],
    default: ''
  },
  projects: {
    type: [{
      title: {
        type: String,
        required: true,
        trim: true
      },
      description: {
        type: String,
        required: false,
        trim: true,
        default: ''
      },
      technologies: {
        type: [String],
        default: []
      }
    }],
    default: []
  },
  cgpa: {
    type: Number,
    min: [0, 'CGPA cannot be negative'],
    max: [10, 'CGPA cannot exceed 10'],
    default: null
  },
  profilePicture: {
    type: String,
    default: null
  },
  profileComplete: {
    type: Boolean,
    default: false
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
  resetPasswordToken: {
    type: String,
    default: null,
    select: false
  },
  resetPasswordExpires: {
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
