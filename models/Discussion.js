const mongoose = require('mongoose');

const discussionSchema = new mongoose.Schema({
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Author ID is required']
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  content: {
    type: String,
    required: [true, 'Content is required'],
    trim: true,
    maxlength: [5000, 'Content cannot exceed 5000 characters']
  },
  subjectTag: {
    type: String,
    required: [true, 'Subject tag is required'],
    trim: true,
    enum: {
      values: [
        'Data Structures', 'Algorithms', 'Database Systems', 'Operating Systems',
        'Computer Networks', 'Software Engineering', 'Machine Learning', 'Web Development',
        'Mobile Development', 'Cybersecurity', 'Cloud Computing', 'DevOps',
        'Mathematics', 'Physics', 'Chemistry', 'Other'
      ],
      message: 'Invalid subject tag'
    },
    index: true
  },
  votes: {
    type: Number,
    default: 0,
    min: 0
  },
  voters: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    voteType: {
      type: String,
      enum: ['upvote', 'downvote']
    }
  }],
  isResolved: {
    type: Boolean,
    default: false
  },
  resolvedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
discussionSchema.index({ subjectTag: 1, createdAt: -1 });
discussionSchema.index({ authorId: 1, createdAt: -1 });
discussionSchema.index({ votes: -1, createdAt: -1 });
discussionSchema.index({ isResolved: 1, createdAt: -1 });

// Method to upvote
discussionSchema.methods.upvote = function(userId) {
  const existingVote = this.voters.find(v => v.userId.toString() === userId.toString());
  
  if (existingVote) {
    if (existingVote.voteType === 'upvote') {
      // Remove upvote
      this.voters = this.voters.filter(v => v.userId.toString() !== userId.toString());
      this.votes -= 1;
    } else {
      // Change downvote to upvote
      existingVote.voteType = 'upvote';
      this.votes += 2; // Remove downvote (-1) and add upvote (+1) = +2
    }
  } else {
    // New upvote
    this.voters.push({ userId, voteType: 'upvote' });
    this.votes += 1;
  }
  
  return this.save();
};

// Method to downvote
discussionSchema.methods.downvote = function(userId) {
  const existingVote = this.voters.find(v => v.userId.toString() === userId.toString());
  
  if (existingVote) {
    if (existingVote.voteType === 'downvote') {
      // Remove downvote
      this.voters = this.voters.filter(v => v.userId.toString() !== userId.toString());
      this.votes += 1;
    } else {
      // Change upvote to downvote
      existingVote.voteType = 'downvote';
      this.votes -= 2; // Remove upvote (+1) and add downvote (-1) = -2
    }
  } else {
    // New downvote
    this.voters.push({ userId, voteType: 'downvote' });
    this.votes -= 1;
  }
  
  return this.save();
};

const commentSchema = new mongoose.Schema({
  discussionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Discussion',
    required: true,
    index: true
  },
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Author ID is required']
  },
  content: {
    type: String,
    required: [true, 'Content is required'],
    trim: true,
    maxlength: [2000, 'Content cannot exceed 2000 characters']
  },
  votes: {
    type: Number,
    default: 0,
    min: 0
  },
  voters: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    voteType: {
      type: String,
      enum: ['upvote', 'downvote']
    }
  }],
  isAccepted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

commentSchema.index({ discussionId: 1, createdAt: -1 });
commentSchema.index({ authorId: 1 });

const Discussion = mongoose.model('Discussion', discussionSchema);
const Comment = mongoose.model('Comment', commentSchema);

module.exports = { Discussion, Comment };
