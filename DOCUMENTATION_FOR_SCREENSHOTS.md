# MentorLink - Documentation Screenshots for Weekly Project Report

---

# SECTION 1: README – Project Overview, Objectives, User Roles & System Architecture

---

## MentorLink - Backend API
### A Data-Driven Interaction and Academic Analytics Platform Backend

---

## Overview

MentorLink is a comprehensive mentorship platform designed to facilitate structured mentor-mentee relationships while generating clean, analytics-ready data for academic insights and data mining.

---

## Project Objectives

- **Clean, structured data schemas** for analytics and data mining  
- **Proper relationships** using MongoDB ObjectId references  
- **Comprehensive interaction logging** for ETL, clustering, and trend analysis  
- **Role-based access control** with middleware-enforced permissions  
- **Secure transactional data handling** – input sanitization, rate limiting, security headers  

---

## User Roles

| Role    | Description                    | Permissions                                      |
|---------|--------------------------------|--------------------------------------------------|
| Junior  | Years 1–2 students             | Request mentorships, participate in discussions  |
| Senior  | Years 3–4 students             | Accept mentorship requests, mentor juniors       |
| Faculty | Staff                          | Mentoring, analytics access                      |
| Admin   | System administrator           | Full control (extensible)                        |

**Role-based profiles**: junior, senior, faculty, admin with department, year, skills, interests, and CGPA tracking.

---

## System Architecture

| Layer      | Technology / Component                                   |
|------------|----------------------------------------------------------|
| Frontend   | API Testing Dashboard (static HTML), future UI           |
| Backend    | Node.js, Express.js, REST API                            |
| Database   | MongoDB (Atlas / local) with Mongoose ODM                |
| Analytics  | Structured interaction data for clustering, ETL, Apriori |

**Architecture principles:**
- Institute email-based registration & authentication  
- Structured student profiles with skills, interests, CGPA  
- Mentorship request & acceptance system (Pending / Accepted / Rejected / Terminated)  
- Structured interaction logging (mentorId, menteeId, topic, subjectTag, interactionType)  
- Discussion & doubt forum with subject tags and voting  

---

# SECTION 2: API & Data Model Documentation (User, Mentorship, Interaction)

---

## User Model

| Field      | Type        | Description                                        |
|------------|-------------|----------------------------------------------------|
| name       | String      | Required, max 100 chars                            |
| email      | String      | Required, unique, lowercase                        |
| password   | String      | Required, hashed with bcrypt, min 6 chars          |
| year       | Number      | Required, 1–4                                      |
| department | String      | Enum: CSE, IT, ECE, EEE, MECH, CIVIL, CHEM, OTHER  |
| role       | String      | Enum: junior, senior, faculty, admin               |
| skills     | [String]    | Array of skills                                    |
| interests  | [String]    | Array of interests                                 |
| cgpa       | Number      | Optional, 0–10                                     |
| isActive   | Boolean     | Default: true                                      |

*Timestamps: createdAt, updatedAt (Mongoose)*

---

## Mentorship Model

| Field       | Type        | Description                                       |
|-------------|-------------|---------------------------------------------------|
| mentorId    | ObjectId    | ref: User, required                               |
| menteeId    | ObjectId    | ref: User, required                               |
| status      | String      | Pending \| Accepted \| Rejected \| Terminated      |
| requestedAt | Date        | Default: Date.now                                 |
| acceptedAt  | Date        | Set when Accepted                                 |
| terminatedAt| Date        | Set when Terminated                               |

*Indexes: (mentorId, menteeId) unique, status, mentorId+status, menteeId+status*

---

## Interaction Model (Analytics-Critical)

| Field             | Type     | Description                                                      |
|-------------------|----------|------------------------------------------------------------------|
| mentorId          | ObjectId | ref: User, required                                              |
| menteeId          | ObjectId | ref: User, required                                              |
| mentorshipId      | ObjectId | ref: Mentorship, required                                        |
| topic             | String   | Required, max 200 chars                                          |
| subjectTag        | String   | Data Structures, Algorithms, ML, Web Dev, etc. (16 enums)        |
| interactionType   | String   | Chat, Video Call, In-Person, Email, Forum, Code Review, etc.     |
| duration          | Number   | Minutes                                                          |
| satisfactionRating| Number   | 1–5                                                              |
| notes             | String   | Max 1000 chars                                                   |
| timestamp         | Date     | Interaction time                                                 |

*Designed for clustering, trend analysis, recommendation engines, and association rule mining.*

---

# SECTION 3: Project Folder Structure

```
MENTORLINK/
├── config/
│   ├── database.js          # MongoDB connection (Atlas/local)
│   └── db.js
├── middleware/
│   ├── auth.js              # JWT verify, RBAC (checkRole, isMentor, isMentee)
│   ├── errorHandler.js
│   ├── security.js          # Helmet, rate limiting
│   └── validation.js        # Email domain validation
├── models/
│   ├── User.js
│   ├── Mentorship.js
│   ├── Interaction.js
│   └── Discussion.js
├── public/
│   └── index.html           # API Testing Dashboard
├── routes/
│   ├── auth.js
│   ├── users.js
│   ├── mentorship.js
│   ├── interactions.js
│   └── discussions.js
├── scripts/
│   └── check-atlas-reachability.js
├── .env
├── .env.example
├── .gitignore
├── API_DOCUMENTATION.md
├── README.md
├── package.json
├── server.js
├── test-connection.js
├── test-atlas-connection.js
├── verify-env.js
└── generate-jwt-secret.js
```

---
