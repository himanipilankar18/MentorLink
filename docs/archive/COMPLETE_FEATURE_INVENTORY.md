# MentorLink - Complete Feature Inventory (April 2026)

**Status:** Fully Implemented & Operational  
**Last Updated:** April 23, 2026  
**Total Features:** 80+ across frontend and backend

---

## 📋 TABLE OF CONTENTS

1. [Backend API Features](#backend-api-features)
2. [Frontend Pages & UI](#frontend-pages--ui)
3. [Database Models & Schemas](#database-models--schemas)
4. [Real-Time Features](#real-time-features)
5. [Security Features](#security-features)
6. [Recommendation Engine](#recommendation-engine)
7. [Middleware & Utilities](#middleware--utilities)

---

## 🔧 BACKEND API FEATURES

### A. AUTHENTICATION ROUTES (`/api/auth`)

#### 1. **User Registration (Multi-Step OTP)**
- **Endpoint:** `POST /api/auth/register`
- **Features:**
  - SPIT email domain validation (`ALLOWED_DOMAINS`)
  - OTP generation (6-digit) with 15-minute expiry
  - Temporary pending registration storage
  - Auto-role detection based on year (1-2=junior, 3-4=senior)
  - Role whitelisting (only: junior, senior, faculty)
  - **Prevents:** Admin role privilege escalation
  - Email notification with OTP
  - Duplicate registration prevention
- **Request:**
  ```json
  {
    "name": "John Doe",
    "email": "john@spit.ac.in",
    "year": 2,
    "branch": "Computer Science",
    "role": "junior" // Optional, auto-detected if not provided
  }
  ```

#### 2. **OTP Verification & Account Activation**
- **Endpoint:** `POST /api/auth/verify-otp`
- **Features:**
  - OTP validation with expiry check
  - Moves pending registration to permanent user database
  - Auto-creates user account
  - Sets `isVerified: true`
  - Triggers welcome email
  - Returns JWT token for immediate login

#### 3. **Login**
- **Endpoint:** `POST /api/auth/login`
- **Features:**
  - Email + password authentication
  - Bcrypt password verification
  - JWT token generation (7-day expiry configurable)
  - Returns user profile + token
  - Rate-limited to prevent brute force
- **Response:**
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "65f...",
      "name": "John Doe",
      "email": "john@spit.ac.in",
      "role": "junior",
      "isVerified": true
    }
  }
  ```

#### 4. **Get Current User (`/me`)**
- **Endpoint:** `GET /api/auth/me`
- **Features:**
  - Returns authenticated user profile
  - Includes role, mentorship stats, profile completion %
  - Protected route (requires JWT)

#### 5. **Create Admin (Protected)**
- **Endpoint:** `POST /api/auth/create-admin`
- **Access:** Admin-only (verified admin can create new admins)
- **Features:**
  - Requires valid JWT token
  - Requires admin role (`checkRole('admin')`)
  - Validates SPIT email domain
  - Auto-verifies admin accounts
  - Sends welcome email to new admin
  - Returns admin details (no password)
  - Prevents non-admin creation

#### 6. **Forgot Password**
- **Endpoint:** `POST /api/auth/forgot-password`
- **Features:**
  - Sends password reset email with token
  - Reset token with expiry
  - Secure token generation

#### 7. **Reset Password**
- **Endpoint:** `POST /api/auth/reset-password`
- **Features:**
  - Validates reset token
  - Updates password with bcrypt
  - Invalidates old tokens

---

### B. USER PROFILE ROUTES (`/api/users`)

#### 1. **Get User Profile**
- **Endpoint:** `GET /api/users/profile/:id`
- **Features:**
  - Fetch full user profile by ID
  - Exclude sensitive data (password)
  - Populate mentor/mentee relationships
  - Calculate and return profile strength (0-100%)
  - Profile strength formula:
    - Profile picture: +20%
    - ≥3 skills: +20%
    - Bio (10-200 chars): +20%
    - Projects: +20%
    - CGPA: +20%

#### 2. **Update User Profile**
- **Endpoint:** `PUT /api/users/profile`
- **Features:**
  - Update: name, year, department, skills, interests, CGPA, bio, projects
  - Update mentorship intent & availability
  - Skill normalization (lowercase, deduplicate, max 10)
  - Bio validation (10-200 chars max)
  - Send notification email for significant changes
  - Return updated profile with strength %
- **Significant fields triggering email:**
  - name, year, department

#### 3. **Get All Mentors**
- **Endpoint:** `GET /api/users/mentors`
- **Features:**
  - Fetch all senior/faculty users
  - Populate mentee requests count
  - Populate active mentorships
  - Filter by year, department, skills
  - Support pagination

#### 4. **Get All Juniors**
- **Endpoint:** `GET /api/users/juniors`
- **Access:** Mentor-only (senior/faculty)
- **Features:**
  - Fetch junior students
  - Filter by year, department, skills
  - Return profile completion %

#### 5. **Search Users**
- **Endpoint:** `GET /api/users/search`
- **Features:**
  - Full-text search by name/email
  - Filter by role, year, department
  - Filter by skills
  - Support pagination

#### 6. **Upload Profile Picture**
- **Endpoint:** `POST /api/users/profile-picture`
- **Features:**
  - Multer-based file upload
  - Image validation (jpeg, jpg, png, gif, webp)
  - 5MB file size limit
  - Auto-save to `public/uploads/profiles/`
  - Return image URL

#### 7. **Get Profile Strength**
- **Endpoint:** `GET /api/users/profile-strength`
- **Features:**
  - Calculate completion %
  - Return missing fields
  - Guide for profile improvement

---

### C. MENTORSHIP ROUTES (`/api/mentorship`)

#### 1. **Request Mentorship**
- **Endpoint:** `POST /api/mentorship/request`
- **Access:** Juniors only
- **Features:**
  - Junior requests mentorship from senior/faculty
  - Validation: mentorship not already requested
  - Compound index prevents duplicates
  - Status: `pending`
  - Includes reason (20+ chars min)
  - Creates notification for mentor
  - Sends email to mentor
  - Auto-creates group chat for accepted requests
- **Request:**
  ```json
  {
    "mentorId": "65f...",
    "reason": "Need help with data structures and algorithms"
  }
  ```

#### 2. **Accept Mentorship Request**
- **Endpoint:** `PUT /api/mentorship/:id/accept`
- **Access:** Mentor-only
- **Features:**
  - Change status to `accepted`
  - Auto-creates private chat group
  - Generate join code for group
  - Add both users to group
  - Send confirmation emails
  - Create notification for mentee
  - Return updated mentorship with group details

#### 3. **Reject Mentorship Request**
- **Endpoint:** `PUT /api/mentorship/:id/reject`
- **Access:** Mentor-only
- **Features:**
  - Change status to `rejected`
  - Capture rejection reason
  - Send rejection email to mentee
  - Create notification

#### 4. **Terminate Mentorship**
- **Endpoint:** `PUT /api/mentorship/:id/terminate`
- **Features:**
  - Change status to `terminated`
  - Record termination time
  - Send notification to both parties
  - Preserve interaction history

#### 5. **Get My Mentorship Requests**
- **Endpoint:** `GET /api/mentorship/my-requests`
- **Access:** Private
- **Features:**
  - Show requests pending for current user
  - Filter by status (pending/accepted/rejected)
  - Show request details & requester info
  - Return with pagination

#### 6. **Get Active Mentorships**
- **Endpoint:** `GET /api/mentorship/active`
- **Access:** Private
- **Features:**
  - Show accepted (active) mentorships
  - Return partner info
  - Return interaction count
  - Return chat group details

#### 7. **Get Mentorship by ID**
- **Endpoint:** `GET /api/mentorship/:id`
- **Features:**
  - Get full mentorship details
  - Include participants info
  - Include group chat info
  - Timeline (requested/accepted/terminated dates)

#### 8. **Get Mentorship Stats**
- **Endpoint:** `GET /api/mentorship/stats`
- **Features:**
  - Total requests sent/received
  - Accepted count
  - Rejection rate
  - Avg mentorship duration

---

### D. INTERACTION LOGGING ROUTES (`/api/interactions`) [MOST CRITICAL FOR ANALYTICS]

#### 1. **Log Interaction (Create)**
- **Endpoint:** `POST /api/interactions`
- **Access:** Private (mentor or mentee in accepted mentorship)
- **Features:**
  - MOST critical for data mining & analytics
  - Only log interactions for ACCEPTED mentorships
  - Validate user is part of mentorship
  - Capture fields:
    - `topic`: Subject of interaction
    - `subjectTag`: Enumerated (Data Structures, Algorithms, etc.)
    - `interactionType`: Chat, Video Call, In-Person, Email, Forum, Code Review, Project Guidance
    - `duration`: Minutes (optional)
    - `satisfactionRating`: 1-5 scale (optional)
    - `notes`: Free-form feedback (max 1000 chars)
    - `timestamp`: Automatic
  - Populate mentor/mentee/mentorship details
  - Return full interaction record
- **Request:**
  ```json
  {
    "mentorshipId": "65f...",
    "topic": "Binary Search Trees Implementation",
    "subjectTag": "Data Structures",
    "interactionType": "Video Call",
    "duration": 45,
    "satisfactionRating": 5,
    "notes": "Great explanation, now understand tree balancing better"
  }
  ```

#### 2. **Get Interactions (Filtered)**
- **Endpoint:** `GET /api/interactions`
- **Features:**
  - Fetch interactions for current user (as mentor or mentee)
  - Filters:
    - By mentorshipId
    - By subjectTag
    - By interactionType
    - By date range (startDate, endDate)
  - Support pagination (limit param)
  - Sort by timestamp (newest first)
  - Return with populated user/mentorship info

#### 3. **Get Interaction Statistics**
- **Endpoint:** `GET /api/interactions/stats`
- **Features:**
  - Subject-wise distribution
  - Interaction type breakdown
  - Avg satisfaction rating by subject
  - Total interaction count by mentor
  - Time-series trends
  - Peak interaction hours/days
- **Response:**
  ```json
  {
    "totalInteractions": 145,
    "bySubject": {
      "Data Structures": { count: 32, avgRating: 4.8 },
      "Algorithms": { count: 28, avgRating: 4.6 }
    },
    "avgDuration": 42,
    "avgSatisfaction": 4.7
  }
  ```

#### 4. **Get Single Interaction**
- **Endpoint:** `GET /api/interactions/:id`
- **Features:**
  - Fetch specific interaction record
  - Full populated details

#### 5. **Update Interaction**
- **Endpoint:** `PUT /api/interactions/:id`
- **Features:**
  - Update notes, rating, duration
  - Only updatable within 24 hours
  - Audit trail (createdAt vs updatedAt)

---

### E. DISCUSSION & FORUM ROUTES (`/api/discussions`)

#### 1. **Create Discussion Post**
- **Endpoint:** `POST /api/discussions`
- **Access:** Private
- **Features:**
  - Create doubt/discussion thread
  - Capture: title (max 200), content (max 5000), subjectTag
  - Subject tags: Data Structures, Algorithms, DB Systems, OS, Networks, Software Eng, ML, Web Dev, Mobile, Cybersecurity, Cloud, DevOps, Math, Physics, Chemistry, Other
  - Auto-populate authorId, timestamp
  - Status: unresolved by default
- **Request:**
  ```json
  {
    "title": "How does merge sort differ from quick sort?",
    "content": "I understand both are O(n log n) but want to know practical differences...",
    "subjectTag": "Algorithms"
  }
  ```

#### 2. **Get All Discussions**
- **Endpoint:** `GET /api/discussions`
- **Features:**
  - Fetch discussions with filters:
    - By subjectTag
    - By authorId
    - By isResolved status
  - Sort options: createdAt, votes
  - Limit & pagination
  - Return with author info

#### 3. **Get Single Discussion with Comments**
- **Endpoint:** `GET /api/discussions/:id`
- **Features:**
  - Fetch discussion + all comments
  - Populate author & comment author details
  - Sort comments by newest first
  - Include vote counts

#### 4. **Add Comment to Discussion**
- **Endpoint:** `POST /api/discussions/:id/comments`
- **Features:**
  - Reply to discussion
  - Content validation (non-empty, max 2000 chars)
  - Track author + timestamp
  - Return updated discussion

#### 5. **Upvote Discussion**
- **Endpoint:** `PUT /api/discussions/:id/upvote`
- **Features:**
  - Toggle upvote
  - Track which user voted
  - Prevent duplicate votes
  - Update vote count

#### 6. **Downvote Discussion**
- **Endpoint:** `PUT /api/discussions/:id/downvote`
- **Features:**
  - Toggle downvote
  - Track which user downvoted
  - Prevent duplicate votes

#### 7. **Mark as Resolved**
- **Endpoint:** `PUT /api/discussions/:id/resolve`
- **Features:**
  - Set `isResolved: true`
  - Record `resolvedAt` timestamp
  - Only author or admin can resolve
  - Send notification to participants

#### 8. **Get Discussion Statistics**
- **Endpoint:** `GET /api/discussions/stats/by-subject`
- **Features:**
  - Count discussions per subject
  - Avg votes per subject
  - Resolved vs unresolved count
- **Response:**
  ```json
  {
    "Data Structures": {
      "total": 24,
      "resolved": 18,
      "avgVotes": 3.2
    }
  }
  ```

---

### F. POST & COMMUNITY ROUTES (`/api/posts`, `/api/communities`)

#### 1. **Create Post**
- **Endpoint:** `POST /api/posts`
- **Features:**
  - Create text/image post
  - Optional community assignment
  - Visibility: public/private/community-only
  - Media support (images uploaded separately)
  - Auto-populate authorId, timestamp

#### 2. **Upload Post Image**
- **Endpoint:** `POST /api/posts/upload-image`
- **Features:**
  - Multer-based image upload
  - Returns image URL
  - Saved to `public/uploads/posts/`
  - 5MB limit, image format validation

#### 3. **Get Posts**
- **Endpoint:** `GET /api/posts`
- **Features:**
  - Fetch all posts with filters
  - Filter by communityId, visibility, authorId
  - Sort by date or engagement
  - Return with author info

#### 4. **Like/Unlike Post**
- **Endpoint:** `PUT /api/posts/:id/like`
- **Features:**
  - Toggle like
  - Track who liked
  - Update like count

#### 5. **Comment on Post**
- **Endpoint:** `POST /api/posts/:id/comments`
- **Features:**
  - Add comment to post
  - Track author + timestamp
  - Support nested replies

#### 6. **Create Community**
- **Endpoint:** `POST /api/communities`
- **Features:**
  - Create subject/interest-based community
  - Set: name, displayName, description, type (public/private), category, tags
  - Creator auto-added as admin
  - Generate settings & permissions
  - Return with member count

#### 7. **Get Communities**
- **Endpoint:** `GET /api/communities`
- **Features:**
  - List all communities
  - Filter by type, category, tags
  - Show member count
  - Show recent posts

#### 8. **Join Community**
- **Endpoint:** `POST /api/communities/:id/join`
- **Features:**
  - Add user to community
  - Set user role to member
  - Return updated community

#### 9. **Leave Community**
- **Endpoint:** `POST /api/communities/:id/leave`
- **Features:**
  - Remove user from community
  - Update member list

---

### G. CHAT & GROUPS ROUTES (`/api/chat`, `/api/groups`)

#### 1. **Get Chat Messages**
- **Endpoint:** `GET /api/chat/group/:id/messages`
- **Features:**
  - Fetch recent messages for group (max 200 limited)
  - Sort oldest first (ascending)
  - Verify user is group member
  - Populate sender info (name, profilePicture)
  - Pagination support

#### 2. **Send Chat Message**
- **Endpoint:** `POST /api/chat/group/:id/messages`
- **Features:**
  - Send message in group
  - Verify membership
  - Emit to all group members via Socket.io
  - Create notification for recipients
  - Store in ChatMessage collection
  - Return message with populated sender

#### 3. **Create Group**
- **Endpoint:** `POST /api/groups`
- **Features:**
  - Create private/public chat group
  - Generate unique join code
  - Creator auto-added as owner
  - Set displayName & description
  - Support avatar upload

#### 4. **Join Group by Code**
- **Endpoint:** `POST /api/groups/join/:code`
- **Features:**
  - Join with invite code
  - Validate code exists
  - Add user to group
  - Set user role to member

#### 5. **Get My Groups**
- **Endpoint:** `GET /api/groups/my`
- **Features:**
  - Fetch groups where user is member
  - Fetch groups where user is creator
  - Return with member list + last message
  - Sort by recent activity

#### 6. **Get Single Group**
- **Endpoint:** `GET /api/groups/:id`
- **Features:**
  - Get group details
  - Populate all members
  - Return join code
  - Show activity stats

#### 7. **Update Group**
- **Endpoint:** `PUT /api/groups/:id`
- **Access:** Owner/Admin only
- **Features:**
  - Update name, description, avatar
  - Change visibility
  - Manage settings

#### 8. **Remove Group Member**
- **Endpoint:** `DELETE /api/groups/:id/members/:userId`
- **Access:** Owner/Admin
- **Features:**
  - Remove user from group
  - Update member list

---

### H. NOTIFICATION ROUTES (`/api/notifications`)

#### 1. **Get Notifications**
- **Endpoint:** `GET /api/notifications`
- **Features:**
  - Fetch user's notifications
  - Optional: unread only filter
  - Pagination support
  - Return unread count
  - Sort by newest first

#### 2. **Mark Single Notification as Read**
- **Endpoint:** `PUT /api/notifications/:id/read`
- **Features:**
  - Update isRead to true
  - Return updated notification
  - Return new unread count

#### 3. **Mark All Notifications as Read**
- **Endpoint:** `PUT /api/notifications/read-all`
- **Features:**
  - Bulk update all unread to read
  - Return count updated
  - Return unread count (0)

#### 4. **Delete Notification**
- **Endpoint:** `DELETE /api/notifications/:id`
- **Features:**
  - Delete single notification
  - Return success message

---

### I. RECOMMENDATION ENGINE ROUTES (`/api/recommendations`)

#### 1. **Get Mentor Recommendations**
- **Endpoint:** `GET /api/recommendations/mentors`
- **Access:** Private (juniors)
- **Features:**
  - AI-powered ML recommendations
  - K-Means clustering of mentors
  - Multi-factor compatibility scoring
  - Returns top 5 mentors with scores (0-100%)
  - Scores include:
    - Skill Match: Jaccard similarity
    - Mentor Quality: Interaction avg rating
    - Activity Level: Interaction frequency
    - Profile Strength: Completeness %
    - Same Department: Match score
    - Schedule Compatibility: Availability match
    - Acceptability Rate: Past acceptance %
    - Recency: Recent activity score
  - Frontend displays with color-coding:
    - Green (≥80%): Excellent match
    - Amber (60-79%): Good match
    - Red (<60%): Fair match
  - Interactive tooltips show component breakdown
  - Fallback to static suggestions if API fails
- **Response:**
  ```json
  {
    "success": true,
    "recommendations": [
      {
        "id": "65f...",
        "name": "Alex Johnson",
        "email": "alex@spit.ac.in",
        "department": "Computer Science",
        "year": 4,
        "score": 87,
        "components": {
          "skillMatch": 85,
          "mentorQuality": 90,
          "activityLevel": 88,
          "profileStrength": 75,
          "sameDepartment": 100,
          "scheduleMatch": 80,
          "acceptabilityRate": 85,
          "recencyScore": 88
        }
      }
    ]
  }
  ```

#### 2. **Get Peer Recommendations**
- **Endpoint:** `GET /api/recommendations/peers`
- **Features:**
  - Similar-interest student suggestions
  - Clustering based on skills/interests
  - Suggest study partners

---

## 🖥️ FRONTEND PAGES & UI

### A. **Public Pages**

#### 1. **Landing Page** (`landing.html`)
- **Features:**
  - Hero section with product overview
  - Features showcase (mentoring, analytics, community)
  - Call-to-action buttons (Get Started, Sign In)
  - Responsive design
  - No authentication required

#### 2. **Register Page** (`register.html`)
- **Features:**
  - Multi-step registration form:
    - Step 1: Email, Name, Year, Branch
    - Step 2: OTP Verification (15-min expiry)
    - Step 3: Password setup (step 3)
  - Email domain validation (SPIT only)
  - Year auto-detection of role
  - Role selector (Junior/Senior/Faculty)
  - Password strength indicator
  - OTP resend functionality
  - Error handling & validation messages
  - Link to login page

#### 3. **Login Page** (`login.html`)
- **Features:**
  - Email + password form
  - "Remember me" option
  - Forgot password link
  - Register link
  - JWT token storage in localStorage
  - Redirect to home on success
  - Error handling

#### 4. **Forgot Password Page** (`forgot-password.html`)
- **Features:**
  - Email input
  - Send reset email
  - Success message

#### 5. **Reset Password Page** (`reset-password.html`)
- **Features:**
  - Token validation
  - New password input
  - Password strength validation
  - Update password & redirect to login

#### 6. **Verify OTP Page** (`verify-otp.html`)
- **Features:**
  - 6-digit OTP input (auto-focus each box)
  - Countdown timer (15 minutes)
  - Resend OTP button
  - Back to register link
  - Auto-focus next input field
  - Redirect to login on success

---

### B. **Authenticated Pages**

#### 1. **Home/Dashboard Page** (`home.html`)
- **Features:**
  - Navigation bar with logout
  - Profile card (name, role, department, year)
  - Profile completion banner
    - Progress bar (0-100%)
    - Missing fields indicator
    - "Complete Profile" CTA button
  - Quick stats (mentorships, interactions, discussions)
  - AI-powered mentor suggestions section:
    - Top 5 recommended mentors
    - Color-coded match scores (green/amber/red)
    - Hover tooltips showing score breakdown
    - Follow/Connect buttons
    - Fallback to static suggestions if API fails
  - Recent discussions widget
  - Quick links to all sections

#### 2. **Profile Page** (`profile.html`)
- **Features:**
  - Display current user profile
  - Profile picture upload
  - Edit profile form:
    - Name, First/Last name, Nickname
    - Year, Department
    - Email (read-only)
    - Skills (max 10, normalized)
    - Interests
    - CGPA
    - Bio (10-200 chars)
    - Projects list
    - Mentorship intent (seeking/offering/both)
    - Availability (weekdays/weekends/flexible)
    - Contact info:
      - WhatsApp number
      - Telegram username
      - Website
      - GitHub URL
  - Profile strength indicator (0-100%)
  - Save changes with validation
  - Delete profile picture option
  - Verification badge display
  - Connected social accounts

#### 3. **Profile Setup Page** (`profile-setup.html`)
- **Features:**
  - Guided setup wizard
  - Step-by-step profile completion
  - Recommended fields to fill
  - Progress indicator
  - Skip option for each step
  - Completion celebration screen

#### 4. **API Dashboard** (`api-dashboard.html`)
- **Features:**
  - Visual API testing interface
  - Connection status indicator
  - Test all endpoints with UI forms
  - View responses in formatted JSON
  - Token management (save/load JWT)
  - Clear output button
  - Error handling & display
  - Quick reference guide

#### 5. **Admin Dashboard** (`dashboard.html`)
- **Features:**
  - Admin panel (accessible to admin role only)
  - User management table
  - Mentorship approval/rejection
  - Discussion moderation
  - Analytics overview
  - System statistics
  - Logs viewer

---

### C. **Feature-Specific Pages** (embedded in dashboard or modals)

#### 6. **Mentorship Section**
- **Features:**
  - Browse available mentors with filters
  - View mentor profiles & match scores
  - Request mentorship form
    - Reason input (min 20 chars)
    - Submit button
  - My requests view
    - Pending requests to me (if mentor)
    - Accept/Reject buttons
    - Rejection reason form
  - Active mentorships view
    - List of current mentorships
    - Chat group link
    - Terminate option
  - Mentorship history

#### 7. **Interaction Logging Section**
- **Features:**
  - Create interaction form:
    - Mentorship selector
    - Topic input
    - Subject tag dropdown
    - Interaction type selector
    - Duration input
    - Satisfaction rating (1-5 stars)
    - Notes textarea
    - Submit button
  - View interactions list
    - Filter by mentorship, subject, type
    - Sort by date
    - Pagination
    - Edit interaction (within 24 hours)

#### 8. **Discussions/Forum Section**
- **Features:**
  - Create discussion form
    - Title input
    - Content textarea
    - Subject tag selector
    - Submit button
  - Discussions list
    - Filter by subject, author, resolved status
    - Sort by votes, date
    - Search functionality
    - Pagination
  - Discussion detail view
    - Full content + comments
    - Upvote/downvote buttons
    - Vote count display
    - Comment form
    - Comments list (sorted newest first)
    - Resolve button (author/admin only)
    - Resolved badge

#### 9. **Communities/Groups Section**
- **Features:**
  - Browse communities
    - List with descriptions
    - Member count
    - Category/tags display
  - Create community form
    - Name, Display name
    - Description
    - Type (public/private)
    - Category selector
    - Tags input
    - Submit button
  - Community detail view
    - Member list
    - Posts feed
    - Join/Leave button
    - Settings (admin only)
  - Community posts
    - Create post form (with image upload)
    - Posts feed with likes/comments
    - Delete post (author/admin)

#### 10. **Chat & Groups Section**
- **Features:**
  - Mentorship chat groups (auto-created when accepted)
    - Message list with sender info
    - Message input & send button
    - Real-time message delivery (Socket.io)
    - Typing indicator
    - Online status
  - Custom groups section
    - Create group form
    - Join group by code
    - Group list (with unread count)
    - Group detail view
    - Member management

#### 11. **Notifications Section**
- **Features:**
  - Notifications bell icon (with unread count)
  - Notifications dropdown/modal
    - List of notifications
    - Read/unread indicator
    - Mark as read button
    - Mark all as read
    - Delete notification
    - Type icons (request, message, mention, etc.)

---

## 🗄️ DATABASE MODELS & SCHEMAS

### 1. **User Model**
```javascript
{
  // Identity
  name: String (required, max 100)
  firstName: String (max 50)
  lastName: String (max 50)
  nickname: String (max 50)
  displayName: String (max 100)
  email: String (required, unique, lowercase)
  password: String (hashed with bcrypt)
  
  // Profile
  year: Number (1-4)
  department: String
  role: String (enum: junior, senior, faculty, admin)
  cgpa: Number (optional)
  
  // Skills & Interests
  skills: [String] (max 10, normalized)
  interests: [String]
  
  // Profile Details
  bio: String (max 200)
  projects: [{
    name: String,
    description: String,
    link: String
  }]
  profilePicture: String (URL)
  
  // Mentorship
  mentorshipIntent: String (seeking/offering/both)
  availability: String (weekdays/weekends/flexible)
  
  // Contact Info
  whatsapp: String
  telegram: String
  website: String (URL)
  githubUrl: String (URL)
  
  // Status
  isVerified: Boolean (email verified)
  isActive: Boolean (account active)
  profileComplete: Boolean
  
  // Timestamps
  createdAt: Date
  updatedAt: Date
  lastActiveAt: Date
}
```
**Indexes:** email (unique), role, year, department, skills

### 2. **Mentorship Model**
```javascript
{
  // Participants (both old and new naming for compatibility)
  requester: ObjectId -> User (mentee)
  recipient: ObjectId -> User (mentor)
  menteeId: ObjectId -> User (required)
  mentorId: ObjectId -> User (required)
  
  // Request Details
  reason: String (max 2000)
  rejectionReason: String (max 2000)
  
  // Status
  status: String (enum: pending, accepted, rejected, terminated)
  
  // Chat
  chatGroupId: ObjectId -> Group
  
  // Timeline
  requestedAt: Date
  acceptedAt: Date
  terminatedAt: Date
  
  // Metadata
  createdAt: Date
  updatedAt: Date
}
```
**Indexes:** mentorId, menteeId, status, requestedAt

### 3. **Interaction Model** [MOST CRITICAL]
```javascript
{
  // Participants
  mentorId: ObjectId -> User (required)
  menteeId: ObjectId -> User (required)
  mentorshipId: ObjectId -> Mentorship (required)
  
  // Interaction Details
  topic: String (required, max 200)
  subjectTag: String (enum: Data Structures, Algorithms, ..., Other)
  interactionType: String (enum: Chat, Video Call, In-Person, Email, Forum, Code Review, Project Guidance)
  
  // Metrics
  duration: Number (minutes, optional)
  satisfactionRating: Number (1-5, optional)
  notes: String (max 1000)
  
  // Timing
  timestamp: Date (required, default now)
  
  // Metadata
  createdAt: Date
  updatedAt: Date
}
```
**Indexes:** mentorId+timestamp, menteeId+timestamp, subjectTag+timestamp, interactionType+timestamp

### 4. **Discussion Model**
```javascript
{
  // Author
  authorId: ObjectId -> User (required)
  
  // Content
  title: String (required, max 200)
  content: String (required, max 5000)
  subjectTag: String (enum: Data Structures, Algorithms, ..., Other)
  
  // Engagement
  votes: Number (default 0)
  voters: [{
    userId: ObjectId -> User,
    voteType: String (enum: upvote, downvote)
  }]
  
  // Resolution
  isResolved: Boolean (default false)
  resolvedAt: Date (optional)
  
  // Timestamps
  createdAt: Date
  updatedAt: Date
}
```
**Indexes:** subjectTag+createdAt, authorId+createdAt, votes+createdAt, isResolved+createdAt

### 5. **Comment Model**
```javascript
{
  discussionId: ObjectId -> Discussion (required)
  authorId: ObjectId -> User (required)
  content: String (required, max 2000)
  
  votes: Number (default 0)
  voters: [{ userId, voteType }]
  
  createdAt: Date
  updatedAt: Date
}
```

### 6. **Post Model**
```javascript
{
  // Author
  authorId: ObjectId -> User (required)
  
  // Content
  content: String (required)
  title: String (optional)
  media: [{
    type: String (image/video)
    url: String
  }]
  
  // Association
  communityId: ObjectId -> Community (optional)
  
  // Visibility
  visibility: String (enum: public, private, community-only)
  
  // Engagement
  likes: [ObjectId -> User]
  comments: [ObjectId -> Comment]
  
  // Timestamps
  createdAt: Date
  updatedAt: Date
}
```

### 7. **Community Model**
```javascript
{
  // Identity
  name: String (unique, lowercase)
  displayName: String (required)
  description: String (optional)
  
  // Settings
  type: String (enum: public, private)
  category: String
  tags: [String]
  
  // Management
  creatorId: ObjectId -> User (required)
  moderators: [ObjectId -> User]
  members: [{
    userId: ObjectId -> User,
    role: String (member/moderator/admin),
    joinedAt: Date
  }]
  
  // Icon/Banner
  icon: String (URL)
  banner: String (URL)
  
  // Timestamps
  createdAt: Date
  updatedAt: Date
}
```

### 8. **Group Model** (Chat Groups for mentorship/study)
```javascript
{
  // Identity
  name: String (unique, normalized)
  displayName: String (required)
  description: String (optional)
  avatar: String (URL)
  
  // Management
  creatorId: ObjectId -> User (required)
  members: [{
    userId: ObjectId -> User,
    role: String (owner/admin/member),
    joinedAt: Date
  }]
  
  // Access
  joinCode: String (unique, 6-char)
  isActive: Boolean (default true)
  
  // Timestamps
  createdAt: Date
  updatedAt: Date
}
```

### 9. **ChatMessage Model**
```javascript
{
  // Content
  groupId: ObjectId -> Group (required)
  senderId: ObjectId -> User (required)
  content: String (required)
  
  // Editing
  editedAt: Date (optional)
  
  // Timestamps
  createdAt: Date
}
```

### 10. **Notification Model**
```javascript
{
  // Recipient
  userId: ObjectId -> User (required)
  
  // Content
  type: String (enum: mentorship_request, mentorship_accepted, message, mention, etc.)
  title: String
  description: String
  
  // Reference
  relatedId: ObjectId (to mentorship/message/post/etc)
  relatedType: String (Mentorship/ChatMessage/Post/etc)
  
  // Status
  isRead: Boolean (default false)
  
  // Timestamps
  createdAt: Date
}
```

---

## 🔄 REAL-TIME FEATURES

### Socket.io Integration

#### 1. **Chat Events**
- `user:typing` - Send when user starts typing
- `user:stop_typing` - Send when user stops typing
- `message:new` - Broadcast new message to group
- `message:edit` - Update message in real-time
- `message:delete` - Delete message in real-time

#### 2. **Online Status**
- `user:online` - User comes online
- `user:offline` - User goes offline
- `user:last_seen` - Update last active timestamp

#### 3. **Notifications**
- `notification:new` - Broadcast new notification
- `notification:read` - Update read status
- `notification:delete` - Delete notification

#### 4. **Group Management**
- `group:member_joined` - New member joins
- `group:member_left` - Member leaves
- `group:member_removed` - Member removed by admin
- `group:settings_updated` - Group settings changed

#### 5. **Mentorship Events**
- `mentorship:request_new` - New request sent
- `mentorship:request_accepted` - Request accepted
- `mentorship:request_rejected` - Request rejected
- `mentorship:terminated` - Mentorship ended

---

## 🔐 SECURITY FEATURES

### 1. **Authentication**
- JWT-based authentication (7-day expiry)
- Bcrypt password hashing (10 salt rounds)
- Email domain validation (SPIT only)
- Token stored in localStorage
- verifyToken middleware on all protected routes

### 2. **Authorization**
- Role-based access control (RBAC)
- checkRole(...roles) middleware
- isMentor / isMentee specific checks
- User ownership validation for updates/deletes
- Admin-only endpoints

### 3. **Input Validation**
- express-validator middleware
- Email format validation
- Subject tag enums
- String length limits
- Number range validation
- Array size limits

### 4. **API Security**
- Helmet.js for security headers
- Rate limiting (express-rate-limit)
- CORS enabled
- Input sanitization
- SQL injection prevention (MongoDB ODM)
- XSS prevention (data escaping)

### 5. **Password Security**
- Bcrypt hashing (configurable rounds)
- Password reset with token validation
- Token expiry (30 minutes)
- Prevent password reuse

### 6. **Admin Escalation Prevention**
- Role whitelisting on registration (no admin allowed)
- Protected admin creation endpoint
  - Requires existing admin authentication
  - Requires admin role
  - Restricted to valid SPIT emails
- Bootstrap script for first admin setup

### 7. **Data Protection**
- Password excluded from API responses
- Sensitive data not logged
- Timestamps for audit trail
- Soft delete support (isActive flag)

---

## 🤖 RECOMMENDATION ENGINE

### Algorithm Details

#### 1. **Mentor Recommendation (ML-Based)**
- **Approach:** K-Means clustering + multi-factor scoring
- **Features extracted (50+ dimensions):**
  - Skill vocabulary matching (Jaccard similarity)
  - Year/seniority level
  - CGPA
  - Profile strength (0-1)
  - Availability matching (weekdays/weekends/flexible)
  - Department match
  - Interaction quality (avg satisfaction rating)
  - Activity level (interaction count)
  - Acceptance rate (accepted vs total requests)
  - Topic breadth (unique subjects mentored)
  - Recency score (recent activity)

#### 2. **Scoring Components**
```
Final Score = Weighted combination of:
  - Skill Match (Jaccard): 0-100
  - Mentor Quality (avg rating): 0-100
  - Activity Level (normalized interactions): 0-100
  - Profile Strength: 0-100
  - Department Match: 0 or 100
  - Schedule Compatibility: 0-100
  - Acceptability Rate: 0-100
  - Recency (last interaction): 0-100
```

#### 3. **Color Coding**
- 🟢 Green (≥80%): Excellent match, highly recommended
- 🟡 Amber (60-79%): Good match, viable option
- 🔴 Red (<60%): Fair match, consider other options

#### 4. **Implementation**
- Backend: Node.js + mathematical library
- Frontend: No external dependencies, pure JS
- Fallback: Static suggestions if API fails
- Interactive tooltips show score breakdown

---

## 🛠️ MIDDLEWARE & UTILITIES

### A. **Middleware Stack**

#### 1. **Security Middleware** (`middleware/security.js`)
- `securityHeaders`: Helmet integration
- `apiLimiter`: Rate limiting (100 requests/15 min)
- `authLimiter`: Auth-specific rate limiting

#### 2. **Authentication Middleware** (`middleware/auth.js`)
- `verifyToken`: JWT validation
- `checkRole(...roles)`: Role-based access
- `isMentor`: Check if mentor (senior/faculty)
- `isMentee`: Check if junior
- `isAdmin`: Check if admin

#### 3. **Validation Middleware** (`middleware/validation.js`)
- `validateRegistration`: Email, year, branch checks
- `validateLogin`: Email, password checks
- `validateInteraction`: Subject tag, type enums
- `validateDiscussion`: Title, content, subject tag
- `validateEmailDomain`: SPIT email validation
- `handleValidationErrors`: Express-validator error handler

#### 4. **Error Handler Middleware** (`middleware/errorHandler.js`)
- `notFound`: 404 handler
- `errorHandler`: Central error logging
- Formatted error responses

### B. **Utility Modules**

#### 1. **Email Service** (`utils/sendEmail.js`)
- Nodemailer integration
- HTML email templates
- SMTP configuration
- Error handling & retry logic
- Email types:
  - Registration OTP
  - Password reset
  - Mentorship notifications
  - Profile update alerts

#### 2. **Notification Service** (`utils/notifications.js`)
- `createAndEmitNotification(userId, type, data)`
- Database logging + Socket.io broadcasting
- Notification types:
  - Mentorship requests
  - Request acceptance/rejection
  - New messages
  - Mentions
  - Profile updates
  - Discussion comments

#### 3. **Recommendation Engine** (`utils/recommendationEngine.js`)
- `generateMentorRecommendations(menteeId, limit)`
- Feature vector building
- K-Means clustering
- Euclidean distance calculation
- Multi-factor scoring
- Top-N selection with filtering

#### 4. **File Upload Handlers** (`utils/uploads.js`)
- Multer configuration for different file types
- Profile pictures (5MB)
- Post images (5MB)
- Community icons/banners (5MB)
- Group avatars (5MB)
- File validation
- Auto-directory creation

---

## 📊 ANALYTICS-READY DATA

### A. **Key Metrics Captured**
- Interaction frequency by subject
- Average satisfaction ratings
- Mentor-mentee pair productivity
- Mentorship acceptance rates
- Discussion engagement metrics
- Topic distribution

### B. **Indexes Optimized For:**
- Time-series analysis (timestamp indexes)
- Subject-wise trends (subjectTag indexes)
- Mentor/mentee analytics (composite indexes)
- Clustering & similarity (feature vectors)

### C. **Future Analytics Pipelines** (Documented)
- ETL to data warehouse
- Recommendation algorithm improvements
- Trend analysis & forecasting
- Student performance correlation
- Mentor effectiveness metrics

---

## 📈 PROJECT STATISTICS

**Total Endpoints:** 60+  
**Total Database Collections:** 10  
**Total Pages:** 11 (frontend HTML)  
**Total Routes:** 11 (backend)  
**Total Models:** 10  
**Lines of Backend Code:** ~4,500  
**Lines of Frontend Code:** ~3,500  

---

## ✅ DEPLOYMENT CHECKLIST

- [x] Core authentication (register/login/OTP)
- [x] Profile management
- [x] Mentorship system
- [x] Interaction logging
- [x] Discussions/forums
- [x] Real-time chat
- [x] Notifications
- [x] Communities & groups
- [x] ML recommendations
- [x] Admin controls
- [ ] Unit tests (TODO)
- [ ] Integration tests (TODO)
- [ ] E2E tests (TODO)
- [ ] Production deployment (TODO)
- [ ] Performance optimization (TODO)

---

## 🎯 NEXT STEPS

1. **Testing Phase**
   - Unit tests for utilities & helpers
   - Integration tests for API endpoints
   - E2E tests for critical flows

2. **Security Hardening**
   - Re-run security audit
   - Address non-critical findings
   - Penetration testing

3. **Performance Optimization**
   - Database query optimization
   - Caching layer (Redis)
   - Frontend bundle optimization

4. **Documentation**
   - API documentation (OpenAPI/Swagger)
   - User guides
   - Developer guides

5. **Deployment**
   - Environment configuration
   - CI/CD pipeline
   - Monitoring & logging
   - Backup strategy

---

**Document Status:** Complete & Comprehensive  
**Last Updated:** April 23, 2026  
**Maintained By:** MentorLink Development Team
