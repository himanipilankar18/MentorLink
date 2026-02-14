# Quick Start Guide - MentorLink Backend

## 🚀 5-Minute Setup

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Configure Environment
```bash
# Copy example file
cp .env.example .env

# Edit .env and set:
# - MONGODB_URI (your MongoDB connection string)
# - JWT_SECRET (a random secret string)
# - ALLOWED_DOMAINS (your institute email domains)
```

### Step 3: Start MongoDB
```bash
# If using local MongoDB:
mongod

# Or use MongoDB Atlas (cloud) - update MONGODB_URI in .env
```

### Step 4: Start Server
```bash
# Development mode (auto-restart on changes)
npm run dev

# Production mode
npm start
```

### Step 5: Test API
```bash
# Health check
curl http://localhost:5000/api/health

# Should return:
# {"success":true,"message":"MentorLink API is running",...}
```

---

## 🧪 Test Authentication Flow

### 1. Register a Junior User
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Junior",
    "email": "junior@spit.ac.in",
    "password": "Test123",
    "year": 2,
    "department": "CSE",
    "role": "junior"
  }'
```

**Save the token from response!**

### 2. Register a Senior User (Mentor)
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Senior",
    "email": "senior@spit.ac.in",
    "password": "Test123",
    "year": 3,
    "department": "CSE",
    "role": "senior",
    "skills": ["JavaScript", "React"]
  }'
```

**Save the mentor's user ID and token!**

### 3. Request Mentorship (as Junior)
```bash
curl -X POST http://localhost:5000/api/mentorship/request \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <junior_token>" \
  -d '{
    "mentorId": "<mentor_user_id>"
  }'
```

**Save the mentorship ID!**

### 4. Accept Request (as Mentor)
```bash
curl -X PUT http://localhost:5000/api/mentorship/<mentorship_id>/accept \
  -H "Authorization: Bearer <mentor_token>"
```

### 5. Log Interaction (as Junior or Mentor)
```bash
curl -X POST http://localhost:5000/api/interactions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "mentorId": "<mentor_user_id>",
    "mentorshipId": "<mentorship_id>",
    "topic": "Data Structures - Binary Trees",
    "subjectTag": "Data Structures",
    "interactionType": "Video Call",
    "duration": 45,
    "satisfactionRating": 5
  }'
```

### 6. Create Discussion
```bash
curl -X POST http://localhost:5000/api/discussions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "title": "How to implement Dijkstra?",
    "content": "I need help with Dijkstra algorithm...",
    "subjectTag": "Algorithms"
  }'
```

---

## 📋 Common Issues

### MongoDB Connection Error
- **Issue**: `MongoServerError: connect ECONNREFUSED`
- **Solution**: 
  - Check if MongoDB is running: `mongod`
  - Verify `MONGODB_URI` in `.env`
  - For Atlas: Check IP whitelist and credentials

### JWT Secret Error
- **Issue**: `jwt malformed` or `invalid signature`
- **Solution**: Set a strong `JWT_SECRET` in `.env` (at least 32 characters)

### Email Domain Error
- **Issue**: `Email domain must be one of: ...`
- **Solution**: Add your email domain to `ALLOWED_DOMAINS` in `.env`

### Port Already in Use
- **Issue**: `EADDRINUSE: address already in use`
- **Solution**: Change `PORT` in `.env` or kill the process using port 5000

---

## 🔍 Verify Setup

### Check Database Connection
```bash
# Server should log: "MongoDB Connected: ..."
```

### Check Routes
```bash
# Visit in browser or use curl:
http://localhost:5000/
# Should show API endpoints
```

### Test Authentication
```bash
# Register → Login → Get /api/auth/me
# All should work without errors
```

---

## 📚 Next Steps

1. **Test all endpoints** using Postman or curl
2. **Review API_DOCUMENTATION.md** for detailed endpoint info
3. **Check data in MongoDB** using MongoDB Compass or CLI
4. **Verify interaction logging** - this is critical for analytics
5. **Test role-based access** - ensure permissions work correctly

---

## 🎯 Critical Testing Points

✅ **Authentication**: Register, login, token validation  
✅ **Role Enforcement**: Juniors can request, mentors can accept  
✅ **Mentorship Flow**: Request → Accept → Log interactions  
✅ **Interaction Logging**: Structured data with all required fields  
✅ **Discussion Forum**: Create, comment, upvote  
✅ **Data Integrity**: Check MongoDB for clean, structured data  

---

## 💡 Pro Tips

- Use **Postman** or **Insomnia** for easier API testing
- Check **MongoDB Compass** to visualize your data
- Use **nodemon** (`npm run dev`) for auto-restart during development
- Keep `.env` file secure and never commit it to git
- Test with multiple users to verify relationships work correctly

---

**Ready to build analytics on top of clean data! 🚀**
