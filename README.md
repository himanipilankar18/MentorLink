# MentorLink - Backend API

A Data-Driven Interaction and Academic Analytics Platform Backend

## 🎯 Overview

MentorLink is a web-based, institute-exclusive mentoring and academic analytics platform.
It enables structured interaction between juniors and seniors while capturing every
mentoring and discussion event as clean, analytics-ready data.

## 🎯 Project Objectives

- Provide a **verified, institute-only platform** for academic mentoring (no outside users).
- Enable **structured interaction** between juniors and seniors for guidance and collaboration.
- Capture mentoring and discussion activity as **structured transactional data**.
- Apply **data mining and analytics** (clustering, recommendations, association rules, trends).
- Support **faculty/admin dashboards** for data-driven academic decision‑making.

## ⚠️ Critical Backend Focus

**This backend is designed with analytics and data mining in mind.**
- Clean, structured data schemas (users, mentorships, interactions, discussions).
- Proper relationships using MongoDB ObjectId references.
- Comprehensive interaction logging for every mentorship event.
- Role-based access control (junior, senior, faculty, admin).
- Secure transactional data handling and API hardening.

**Frontend UI can be replaced later. Backend data quality is the priority.**

## 🚀 Features (Implemented in Backend)

### A. Core Platform & Security
- Institute email-based registration with domain validation (`ALLOWED_DOMAINS`).
- Secure password hashing with **bcrypt**.
- **JWT** authentication with token expiry and protected routes.
- Helmet-based security headers, rate limiting, and input validation/sanitization.

### B. Student & Account Features
- Account management: register, login, and get current user (`/api/auth/me`).
- Structured academic profile:
  - Year, department, role (junior/senior/faculty/admin).
  - Skills, interests, optional CGPA.
- APIs to fetch mentors and juniors with filters.

### C. Mentorship Module
- Juniors can request mentorship from seniors/faculty.
- Mentors can accept/reject/terminate requests.
- Duplicate requests prevented via compound index.
- Status tracking: **Pending / Accepted / Rejected / Terminated**.
- Endpoints for "my requests" and "active mentorships" for dashboards.

### D. Structured Interaction Logging (MOST CRITICAL)
- Every interaction stored with:
  - `mentorId`, `menteeId`, `mentorshipId`
  - `topic`, `subjectTag`, `interactionType`
  - `timestamp`, `duration`, `satisfactionRating`, `notes`
- Indexes optimized for analytics queries (by subject, interactionType, mentor/mentee).
- Designed to feed clustering, recommendation, trend analysis, and association rule mining.

### E. Discussion & Doubt Forum
- Subject-tagged discussions with title, content, and subjectTag.
- Nested comments with voting.
- Upvote/downvote on discussions.
- Resolved/unresolved tracking with `isResolved` and `resolvedAt`.
- Statistics endpoint for subject-wise engagement.

### F. Role-Based Access Control
- JWT verification middleware plus role checks:
  - Juniors can request mentorships.
  - Seniors/faculty can accept/reject mentorships.
  - Faculty/admin endpoints can be restricted via `checkRole`.
- Designed to align with **Student / Admin / Faculty** roles from the project plan.

### G. Analytics-Ready Data & Hardening
- All schemas include timestamps (`createdAt`, `updatedAt`) for time-series analysis.
- Interaction and discussion data structured for future:
  - ETL to a warehouse (PostgreSQL/MySQL).
  - Clustering & recommendation models.
  - Trend analysis and academic reporting dashboards.
- Input sanitization, rate limiting, and centralized error handling.

## 📋 Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or Atlas)
- npm or yarn

**Note**: 
- For **MongoDB Atlas** (cloud): See `MONGODB_ATLAS_SETUP.md` for complete setup guide
- For **Local MongoDB**: See `MONGODB_SETUP.md` for troubleshooting
- **Quick test**: Run `node test-atlas-connection.js` to verify connection

## 🔧 Installation

1. Clone the repository
```bash
git clone <repository-url>
cd MentorLink
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.example .env
```

4. Configure `.env` file:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/mentorlink
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRE=7d
ALLOWED_DOMAINS=spit.ac.in,yourinstitute.ac.in
```

5. **Set up MongoDB Atlas** (if using cloud database)
   - See `MONGODB_ATLAS_SETUP.md` for complete step-by-step guide
   - Or see `ATLAS_QUICK_START.md` for quick setup
   - **Test connection**: `node test-atlas-connection.js`

   **OR use Local MongoDB** (if running locally):
   ```bash
   # Windows
   mongod
   
   # macOS/Linux
   sudo systemctl start mongod
   ```

6. Start the server
```bash
# Development mode (with nodemon)
npm run dev

# Production mode
npm start
```

## 📚 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Users
- `GET /api/users/profile/:id` - Get user profile
- `PUT /api/users/profile` - Update own profile
- `GET /api/users/mentors` - Get all mentors
- `GET /api/users/juniors` - Get all juniors (mentors only)

### Mentorship
- `POST /api/mentorship/request` - Request mentorship (juniors only)
- `PUT /api/mentorship/:id/accept` - Accept request (mentors only)
- `PUT /api/mentorship/:id/reject` - Reject request (mentors only)
- `GET /api/mentorship/my-requests` - Get user's mentorship requests
- `GET /api/mentorship/active` - Get active mentorships
- `PUT /api/mentorship/:id/terminate` - Terminate mentorship

### Interactions (MOST CRITICAL)
- `POST /api/interactions` - Log structured interaction
- `GET /api/interactions` - Get interactions (with filters)
- `GET /api/interactions/stats` - Get interaction statistics
- `GET /api/interactions/:id` - Get single interaction
- `PUT /api/interactions/:id` - Update interaction

### Discussions
- `POST /api/discussions` - Create discussion post
- `GET /api/discussions` - Get discussions (with filters)
- `GET /api/discussions/:id` - Get discussion with comments
- `POST /api/discussions/:id/comments` - Add comment
- `PUT /api/discussions/:id/upvote` - Upvote discussion
- `PUT /api/discussions/:id/downvote` - Downvote discussion
- `PUT /api/discussions/:id/resolve` - Mark as resolved
- `GET /api/discussions/stats/by-subject` - Get statistics by subject

## 🔐 Authentication

Most endpoints require authentication. Include JWT token in headers:
```
Authorization: Bearer <your_jwt_token>
```

## 📊 Data Models

### User Schema
- name, email, password (hashed)
- year, department, role
- skills[], interests[]
- cgpa (optional)

### Mentorship Schema
- mentorId, menteeId
- status (Pending/Accepted/Rejected/Terminated)
- requestedAt, acceptedAt, terminatedAt

### Interaction Schema (CRITICAL)
- mentorId, menteeId, mentorshipId
- topic, subjectTag, interactionType
- timestamp, duration, satisfactionRating
- notes

### Discussion Schema
- authorId, title, content
- subjectTag, votes
- isResolved, resolvedAt
- Comments with votes

## 🧪 Testing the API

### Option 1: Web Dashboard (Recommended)
A beautiful frontend testing dashboard is included!

1. **Start the server**:
   ```bash
   npm run dev
   ```

2. **Open in browser**:
   ```
   http://localhost:5000
   ```

3. **Features**:
   - ✅ Visual API testing interface
   - ✅ Connection status indicator
   - ✅ Register/Login forms
   - ✅ Test all endpoints easily
   - ✅ View responses in formatted JSON
   - ✅ Token management (auto-saved)

### Option 2: Postman/API Client

1. Import the API endpoints into Postman
2. Start with `/api/auth/register` to create a user
3. Use the returned token for authenticated requests
4. Test each endpoint systematically

### Option 3: Test MongoDB Connection

Test your database connection before starting:
```bash
node test-connection.js
```

## 🎓 Why Backend-First Approach?

This backend is designed to generate clean, structured data for:
- **ETL Processes** - Easy extraction to data warehouse
- **Clustering** - User and interaction clustering
- **Recommendation Engines** - Mentor-mentee matching
- **Apriori Algorithm** - Association rule mining
- **Trend Analysis** - Subject engagement trends

If backend data is messy, mining results will be wrong.

## 🔒 Security Features

- Password hashing with bcrypt
- JWT token authentication
- Rate limiting
- Input validation and sanitization
- Security headers (Helmet)
- Role-based access control
- Email domain validation

## 📝 Notes

- All timestamps are automatically managed by Mongoose
- ObjectId references ensure data integrity
- Indexes are optimized for analytics queries
- Error handling is comprehensive
- Validation is enforced at schema and route levels

## 🚧 Future Enhancements

- Analytics dashboard endpoints
- Data export for ETL
- Advanced filtering and search
- Notification system
- File uploads for project sharing

## 📄 License

ISC

## 👥 Contributors

[Your Name/Team]

---

**Remember: Focus on clean data structure. Frontend can wait. Backend architecture is critical.**
