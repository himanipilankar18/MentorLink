# MentorLink API Documentation

## Base URL
```
http://localhost:5000/api
```

## Authentication
Most endpoints require JWT authentication. Include token in headers:
```
Authorization: Bearer <token>
```

---

## 🔐 Authentication Endpoints

### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john.doe@spit.ac.in",
  "password": "SecurePass123",
  "year": 2,
  "department": "CSE",
  "role": "junior",
  "skills": ["JavaScript", "Python"],
  "interests": ["Web Development", "AI"],
  "cgpa": 8.5
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully. Please check your SPIT email for a 6-digit OTP to verify your account.",
  "user": { ... }
}
```

**Note:** User must verify email with OTP before logging in.

### Verify OTP
```http
POST /api/auth/verify-otp
Content-Type: application/json

{
  "email": "john.doe@spit.ac.in",
  "otp": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Email verified successfully! You can now log in."
}
```

### Resend OTP
```http
POST /api/auth/resend-otp
Content-Type: application/json

{
  "email": "john.doe@spit.ac.in"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP has been resent to your email"
}
```

### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john.doe@spit.ac.in",
  "password": "SecurePass123"
}
```

### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <token>
```

---

## 👥 User Endpoints

### Get User Profile
```http
GET /api/users/profile/:userId
Authorization: Bearer <token>
```

### Update Own Profile
```http
PUT /api/users/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "John Updated",
  "skills": ["JavaScript", "Python", "React"],
  "cgpa": 9.0
}
```

### Get All Mentors
```http
GET /api/users/mentors?department=CSE
Authorization: Bearer <token>
```

### Get All Juniors (Mentors Only)
```http
GET /api/users/juniors?department=CSE
Authorization: Bearer <token>
```

---

## 🤝 Mentorship Endpoints

### Request Mentorship (Juniors Only)
```http
POST /api/mentorship/request
Authorization: Bearer <token>
Content-Type: application/json

{
  "mentorId": "mentor_object_id"
}
```

### Accept Request (Mentors Only)
```http
PUT /api/mentorship/:mentorshipId/accept
Authorization: Bearer <token>
```

### Reject Request (Mentors Only)
```http
PUT /api/mentorship/:mentorshipId/reject
Authorization: Bearer <token>
```

### Get My Requests
```http
GET /api/mentorship/my-requests?status=Pending
Authorization: Bearer <token>
```

### Get Active Mentorships
```http
GET /api/mentorship/active
Authorization: Bearer <token>
```

### Terminate Mentorship
```http
PUT /api/mentorship/:mentorshipId/terminate
Authorization: Bearer <token>
```

---

## 📊 Interaction Endpoints (MOST CRITICAL)

### Log Interaction
```http
POST /api/interactions
Authorization: Bearer <token>
Content-Type: application/json

{
  "mentorId": "mentor_object_id",
  "mentorshipId": "mentorship_object_id",
  "topic": "Data Structures - Binary Trees",
  "subjectTag": "Data Structures",
  "interactionType": "Video Call",
  "duration": 45,
  "satisfactionRating": 5,
  "notes": "Great session on tree traversal"
}
```

**Subject Tags:**
- Data Structures, Algorithms, Database Systems, Operating Systems
- Computer Networks, Software Engineering, Machine Learning
- Web Development, Mobile Development, Cybersecurity
- Cloud Computing, DevOps, Mathematics, Physics, Chemistry, Other

**Interaction Types:**
- Chat, Video Call, In-Person, Email
- Forum Discussion, Code Review, Project Guidance

### Get Interactions
```http
GET /api/interactions?mentorshipId=xxx&subjectTag=Data Structures&interactionType=Video Call&limit=50
Authorization: Bearer <token>
```

### Get Interaction Statistics
```http
GET /api/interactions/stats?mentorshipId=xxx&startDate=2024-01-01&endDate=2024-12-31
Authorization: Bearer <token>
```

### Get Single Interaction
```http
GET /api/interactions/:interactionId
Authorization: Bearer <token>
```

### Update Interaction
```http
PUT /api/interactions/:interactionId
Authorization: Bearer <token>
Content-Type: application/json

{
  "duration": 60,
  "satisfactionRating": 5,
  "notes": "Updated notes"
}
```

---

## 💬 Discussion Endpoints

### Create Discussion
```http
POST /api/discussions
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "How to implement Dijkstra's algorithm?",
  "content": "I'm struggling with understanding the priority queue implementation...",
  "subjectTag": "Algorithms"
}
```

### Get Discussions
```http
GET /api/discussions?subjectTag=Algorithms&isResolved=false&sortBy=votes&order=desc&limit=20
Authorization: Bearer <token>
```

### Get Discussion with Comments
```http
GET /api/discussions/:discussionId
Authorization: Bearer <token>
```

### Add Comment
```http
POST /api/discussions/:discussionId/comments
Authorization: Bearer <token>
Content-Type: application/json

{
  "content": "You can use a min-heap for the priority queue..."
}
```

### Upvote Discussion
```http
PUT /api/discussions/:discussionId/upvote
Authorization: Bearer <token>
```

### Downvote Discussion
```http
PUT /api/discussions/:discussionId/downvote
Authorization: Bearer <token>
```

### Mark as Resolved
```http
PUT /api/discussions/:discussionId/resolve
Authorization: Bearer <token>
```

### Get Statistics by Subject
```http
GET /api/discussions/stats/by-subject
Authorization: Bearer <token>
```

---

## 📝 Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (no/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Server Error

---

## 🔍 Query Parameters

### Common Filters
- `limit` - Limit results (default: 50)
- `sortBy` - Sort field (e.g., `votes`, `createdAt`)
- `order` - Sort order (`asc` or `desc`)

### Mentorship Filters
- `status` - Filter by status (Pending/Accepted/Rejected/Terminated)

### Interaction Filters
- `mentorshipId` - Filter by mentorship
- `subjectTag` - Filter by subject
- `interactionType` - Filter by type
- `startDate` - Start date (ISO format)
- `endDate` - End date (ISO format)

### Discussion Filters
- `subjectTag` - Filter by subject
- `authorId` - Filter by author
- `isResolved` - Filter by resolved status (`true`/`false`)

---

## ⚠️ Important Notes

1. **Email Domain Validation**: Only emails from `ALLOWED_DOMAINS` (in `.env`) are accepted
2. **Role Constraints**: 
   - Juniors: Year 1-2 only
   - Seniors: Year 3-4 only
3. **Mentorship**: Only juniors can request, only seniors/faculty can accept
4. **Interaction Logging**: Requires active (Accepted) mentorship
5. **Rate Limiting**: Authentication endpoints limited to 5 requests per 15 minutes

---

## 🧪 Testing Workflow

1. **Register** a junior user
2. **Register** a senior user (mentor)
3. **Login** as junior, get token
4. **Request mentorship** with mentor's ID
5. **Login** as mentor, get token
6. **Accept** the mentorship request
7. **Log interactions** using the mentorship ID
8. **Create discussions** and add comments
9. **View statistics** for analytics

---

## 📊 Data Structure for Analytics

### Interaction Data (Critical)
```json
{
  "mentorId": "ObjectId",
  "menteeId": "ObjectId",
  "mentorshipId": "ObjectId",
  "topic": "string",
  "subjectTag": "enum",
  "interactionType": "enum",
  "timestamp": "Date",
  "duration": "number",
  "satisfactionRating": "number"
}
```

This structured data enables:
- Clustering by subject/interaction type
- Trend analysis over time
- Association rule mining
- Recommendation engines

---

**Remember: Clean backend data = Accurate analytics results**
