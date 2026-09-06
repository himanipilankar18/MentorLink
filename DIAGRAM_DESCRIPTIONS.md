# MentorLink - Detailed Diagram Descriptions

## Overview
This document contains detailed descriptions for all diagrams required for the MentorLink system documentation. Each section provides comprehensive specifications that can be used to generate professional diagrams using external tools (Lucidchart, Draw.io, Visio, or AI image generation tools).

---

## 4.1 System Architecture Diagram

### Purpose
Shows the overall system architecture, including frontend, backend, database, external services, and data flow.

### Components & Layout

**Client Layer (Top)**
- **Frontend Application** (React + Vite)
  - Running on browser
  - Communicates via REST API and WebSocket
  - Displays UI for mentorship management, discussions, communities, analytics
  
**API Gateway & Load Balancer (Middle-Top)**
- Express.js Server (Node.js)
- Port: 3000 (or configured via env)
- Functions:
  - Authentication & Authorization
  - Request validation and sanitization
  - Rate limiting
  - CORS handling
  - Error handling

**API Routes/Services Layer (Middle)**
- **Authentication Service**
  - JWT token generation/verification
  - Password hashing (bcrypt)
  - Email verification
  - OTP management
  
- **Core Business Services**
  - Mentorship Service (create, accept, reject, terminate requests)
  - Interaction Logging Service (record every interaction for analytics)
  - Discussion & Forum Service (doubts, comments, voting)
  - Community & Group Service (create communities, group management)
  - Chat & Notification Service (real-time messaging, alerts)
  - Recommendation Engine (peer matching, skill-based suggestions)
  - Analytics Service (clustering, trend analysis)

**Real-time Layer (Middle)**
- Socket.io Server
- Handles:
  - Live chat messaging
  - Real-time notifications
  - Online status updates
  - Group activity feeds

**Data Layer (Bottom)**
- **MongoDB Atlas Database**
  - Collections: Users, Mentorships, Interactions, Discussions, Posts, Communities, Groups, ChatMessages, Notifications
  - Indexes: Optimized for analytics queries
  - Relationships: ObjectId references between collections

**External Services (Bottom-Right)**
- **Email Service** (SMTP/SendGrid)
  - Registration verification
  - Password reset
  - Notifications
  
- **File Storage** (Local /uploads or Cloud)
  - Profile pictures
  - Post attachments
  - Community images
  - Profile documents

**Security Layer (Cross-cutting)**
- Helmet headers
- Rate limiting
- Input validation/sanitization
- JWT middleware
- Role-based access control (RBAC)

### Data Flow Arrows
1. Browser → Express.js via HTTP/REST
2. Browser ↔ Socket.io for real-time updates
3. Express.js → MongoDB for CRUD operations
4. Express.js → SMTP for email notifications
5. Express.js → File storage for document uploads
6. Express.js → External APIs for analytics/recommendations

---

## 4.2 Use Case Diagram

### Purpose
Shows the interactions between different user types (actors) and the system functions they can perform.

### Actors
1. **Junior User** (Student seeking mentorship)
2. **Senior User** (Student providing mentorship)
3. **Faculty User** (Academic advisor, can both mentor and review)
4. **Admin User** (System administrator)
5. **System** (automated background processes)

### Use Cases & Actor Relationships

**Authentication & Profile (All Users)**
- Register with institute email
- Login to system
- Update profile (year, department, skills, interests, CGPA)
- Upload profile picture
- Manage account settings
- Request password reset
- Verify email/OTP

**Mentorship Management (Junior Users)**
- Browse available mentors (with filters: year, department, skills)
- Request mentorship from senior/faculty
- View pending mentorship requests
- View active mentorships
- Log interactions with mentor
- Rate mentorship experience
- Rate mentor satisfaction
- Terminate mentorship

**Mentorship Management (Senior/Faculty Users)**
- View incoming mentorship requests
- Accept mentorship request
- Reject mentorship request with reason
- View active mentorships
- View mentees and their progress
- Terminate mentorship relationship
- Log interaction notes
- View interaction history

**Interaction Logging (Mentor & Mentee)**
- Record interaction details
  - Topic discussed
  - Subject tag (Data Structures, Algorithms, etc.)
  - Interaction type (Chat, Video Call, In-Person, etc.)
  - Duration
  - Satisfaction rating
  - Notes
- View interaction history
- Export interaction data

**Discussion & Forum (All Users)**
- Create discussion/doubt post with subject tag
- Comment on discussions
- Vote (upvote/downvote) on discussions
- Mark discussion as resolved
- Search discussions by subject
- View discussion statistics

**Community Management (Senior/Faculty)**
- Create community/group
- Invite members
- Manage community content
- Moderate discussions

**Notifications (All Users)**
- Receive mentorship request notifications
- Receive interaction reminders
- Receive discussion responses
- Receive system alerts
- Manage notification preferences

**Real-time Chat (Active Mentorship Users)**
- Send direct messages to mentor/mentee
- Create group chat for mentorship
- View chat history
- Share file attachments
- See online status

**Analytics Dashboard (Faculty/Admin)**
- View mentor performance metrics
- View mentee progress analytics
- Generate reports on interaction trends
- View subject-wise engagement statistics
- Analyze clustering of students by skill level

**Recommendations (System)**
- Suggest mentors based on skills
- Recommend peer learning groups
- Suggest discussion topics based on interaction history
- Recommend course/skill improvements

---

## 4.3 Class Diagram

### Purpose
Shows the data model structure, classes (collections), attributes, and relationships between entities.

### Classes & Relationships

```
CLASS: User
├─ Attributes:
│  ├─ _id: ObjectId (Primary Key)
│  ├─ name: String
│  ├─ firstName: String
│  ├─ lastName: String
│  ├─ nickname: String
│  ├─ displayName: String
│  ├─ email: String (Unique, Indexed)
│  ├─ password: String (Hashed with bcrypt)
│  ├─ role: Enum [junior, senior, faculty, admin]
│  ├─ year: Number (1-4, for current academic year)
│  ├─ department: String (CSE, ECE, Mechanical, etc.)
│  ├─ skills: Array<String> (Normalized, indexed)
│  ├─ interests: Array<String>
│  ├─ cgpa: Number (Optional, 0.0-10.0)
│  ├─ profilePicture: String (URL)
│  ├─ bio: String
│  ├─ whatsapp: String
│  ├─ telegram: String
│  ├─ website: String
│  ├─ githubUrl: String
│  ├─ isEmailVerified: Boolean
│  ├─ isOnline: Boolean
│  ├─ lastActiveAt: Date
│  ├─ profileComplete: Boolean
│  ├─ createdAt: Date
│  ├─ updatedAt: Date
└─ Relationships:
   ├─ 1-to-Many with Mentorship (as mentor)
   ├─ 1-to-Many with Mentorship (as mentee)
   ├─ 1-to-Many with Interaction (as mentor)
   ├─ 1-to-Many with Interaction (as mentee)
   ├─ 1-to-Many with Discussion (as author)
   ├─ 1-to-Many with Post (as author)
   ├─ 1-to-Many with Group (as creator or member)
   ├─ 1-to-Many with ChatMessage (as sender)
   └─ 1-to-Many with Notification (as recipient)

CLASS: Mentorship
├─ Attributes:
│  ├─ _id: ObjectId (Primary Key)
│  ├─ mentorId: ObjectId (Foreign Key → User, Indexed)
│  ├─ menteeId: ObjectId (Foreign Key → User, Indexed)
│  ├─ requester: ObjectId (Foreign Key → User)
│  ├─ recipient: ObjectId (Foreign Key → User)
│  ├─ reason: String (Mentee's reason for request)
│  ├─ rejectionReason: String (If rejected)
│  ├─ status: Enum [pending, accepted, rejected, terminated]
│  ├─ chatGroupId: ObjectId (Foreign Key → Group, for mentorship chat)
│  ├─ requestedAt: Date
│  ├─ acceptedAt: Date
│  ├─ terminatedAt: Date
│  ├─ createdAt: Date
│  ├─ updatedAt: Date
│  ├─ Indexes:
│  │  ├─ mentorId (for finding mentorships by mentor)
│  │  ├─ menteeId (for finding mentorships by mentee)
│  │  ├─ status (for filtering by status)
│  │  └─ Compound: (mentorId, menteeId, status)
└─ Relationships:
   ├─ Many-to-1 with User (mentor)
   ├─ Many-to-1 with User (mentee)
   ├─ 1-to-Many with Interaction (interactions within this mentorship)
   └─ 1-to-1 with Group (chat group for communication)

CLASS: Interaction (★ MOST CRITICAL FOR ANALYTICS ★)
├─ Attributes:
│  ├─ _id: ObjectId (Primary Key)
│  ├─ mentorId: ObjectId (Foreign Key → User, Indexed)
│  ├─ menteeId: ObjectId (Foreign Key → User, Indexed)
│  ├─ mentorshipId: ObjectId (Foreign Key → Mentorship, Indexed)
│  ├─ topic: String (Discussion topic, e.g., "Sorting Algorithms")
│  ├─ subjectTag: String (Indexed)
│  │  ├─ Values: Data Structures, Algorithms, Database Systems, 
│  │  │           Operating Systems, Networks, Software Engineering,
│  │  │           Machine Learning, Web Dev, Mobile Dev, 
│  │  │           Cybersecurity, Cloud Computing, DevOps, etc.
│  ├─ interactionType: String (Indexed)
│  │  ├─ Values: Chat, Video Call, In-Person, Email, Forum Discussion, Code Review, Project Guidance
│  ├─ duration: Number (in minutes)
│  ├─ satisfactionRating: Number (1-5 scale)
│  ├─ notes: String (Key learnings, next steps)
│  ├─ timestamp: Date (When interaction occurred, Indexed)
│  ├─ createdAt: Date
│  ├─ updatedAt: Date
│  ├─ Indexes:
│  │  ├─ mentorId
│  │  ├─ menteeId
│  │  ├─ subjectTag
│  │  ├─ interactionType
│  │  ├─ timestamp
│  │  └─ Compound: (subjectTag, interactionType, timestamp)
│  │           (for analytics queries)
└─ Relationships:
   ├─ Many-to-1 with User (mentor)
   ├─ Many-to-1 with User (mentee)
   └─ Many-to-1 with Mentorship

CLASS: Discussion
├─ Attributes:
│  ├─ _id: ObjectId
│  ├─ title: String
│  ├─ content: String
│  ├─ author: ObjectId (Foreign Key → User, Indexed)
│  ├─ subjectTag: String (Indexed, same enum as Interaction)
│  ├─ isResolved: Boolean
│  ├─ resolvedAt: Date
│  ├─ upvotes: Number
│  ├─ downvotes: Number
│  ├─ views: Number
│  ├─ comments: Array<Comment>
│  │  └─ Comment: { _id, author, content, createdAt }
│  ├─ createdAt: Date
│  ├─ updatedAt: Date
└─ Relationships:
   ├─ Many-to-1 with User (author)
   └─ 1-to-Many (implicit comments array)

CLASS: Post
├─ Attributes:
│  ├─ _id: ObjectId
│  ├─ title: String
│  ├─ content: String
│  ├─ author: ObjectId (Foreign Key → User, Indexed)
│  ├─ community: ObjectId (Foreign Key → Community)
│  ├─ images: Array<String> (URLs)
│  ├─ likes: Array<ObjectId> (User IDs who liked)
│  ├─ shares: Number
│  ├─ createdAt: Date
│  ├─ updatedAt: Date
└─ Relationships:
   ├─ Many-to-1 with User (author)
   └─ Many-to-1 with Community

CLASS: Community
├─ Attributes:
│  ├─ _id: ObjectId
│  ├─ name: String
│  ├─ description: String
│  ├─ creator: ObjectId (Foreign Key → User, Indexed)
│  ├─ members: Array<ObjectId> (User IDs)
│  ├─ communityType: String (skill-based, year-based, dept-based, interest-based)
│  ├─ category: String
│  ├─ isActive: Boolean
│  ├─ createdAt: Date
│  ├─ updatedAt: Date
└─ Relationships:
   ├─ Many-to-1 with User (creator)
   ├─ Many-to-Many with User (members, implicit via array)
   └─ 1-to-Many with Post

CLASS: Group
├─ Attributes:
│  ├─ _id: ObjectId
│  ├─ name: String
│  ├─ description: String
│  ├─ creatorId: ObjectId (Foreign Key → User, Indexed)
│  ├─ members: Array<Member>
│  │  └─ Member: { userId, joinedAt, role (owner/member) }
│  ├─ isActive: Boolean
│  ├─ isPrivate: Boolean
│  ├─ createdAt: Date
│  ├─ updatedAt: Date
└─ Relationships:
   ├─ Many-to-1 with User (creator)
   ├─ Many-to-Many with User (members)
   ├─ 1-to-Many with ChatMessage
   └─ Referenced by Mentorship (for mentorship chat group)

CLASS: ChatMessage
├─ Attributes:
│  ├─ _id: ObjectId
│  ├─ senderId: ObjectId (Foreign Key → User, Indexed)
│  ├─ recipientId: ObjectId (Foreign Key → User, optional for direct chat)
│  ├─ groupId: ObjectId (Foreign Key → Group, optional for group chat)
│  ├─ content: String
│  ├─ attachments: Array<String> (File URLs)
│  ├─ isRead: Boolean
│  ├─ createdAt: Date
│  ├─ updatedAt: Date
└─ Relationships:
   ├─ Many-to-1 with User (sender)
   ├─ Many-to-1 with User (recipient)
   └─ Many-to-1 with Group

CLASS: Notification
├─ Attributes:
│  ├─ _id: ObjectId
│  ├─ recipient: ObjectId (Foreign Key → User, Indexed)
│  ├─ sender: ObjectId (Foreign Key → User, optional)
│  ├─ type: String (mentorship_request, interaction_logged, discussion_response, etc.)
│  ├─ title: String
│  ├─ message: String
│  ├─ relatedEntity: ObjectId (Reference to relevant document)
│  ├─ isRead: Boolean
│  ├─ createdAt: Date
└─ Relationships:
   ├─ Many-to-1 with User (recipient)
   └─ Many-to-1 with User (sender, optional)
```

### Key Relationships Summary
- **User ↔ Mentorship**: 1-to-Many (both as mentor and mentee)
- **User ↔ Interaction**: 1-to-Many (both as mentor and mentee)
- **Mentorship ↔ Interaction**: 1-to-Many (interactions within mentorship)
- **User ↔ Discussion**: 1-to-Many (user as author)
- **User ↔ Community**: Many-to-Many (via implicit members array)
- **User ↔ Group**: Many-to-Many (via members array in Group)
- **User ↔ ChatMessage**: 1-to-Many (both as sender and recipient)

---

## 4.4 Sequence Diagram: Mentorship Request Flow

### Purpose
Shows the step-by-step flow when a junior user requests mentorship from a senior user, including validation, notifications, and response.

### Actors
1. **Junior (Mentee)** - Browser/Client
2. **Frontend** - React UI
3. **Backend API** - Express.js Server
4. **MongoDB** - Database
5. **Socket.io** - Real-time Service
6. **Email Service** - SMTP/Email Provider
7. **Senior (Mentor)** - Browser/Client

### Sequence Steps

```
1. JUNIOR INITIATES REQUEST
   Junior fills mentorship request form (mentor selection, reason)
   ↓
   Frontend validates input (mentor exists, not duplicate request)
   ↓
   Frontend sends POST /api/mentorship/request
   {
     mentorId: "ObjectId",
     reason: "I want to learn algorithms..."
   }

2. BACKEND VALIDATION
   Backend receives request
   ↓
   Verify JWT token (authentication)
   ↓
   Check if requester is junior/valid user
   ↓
   Check if mentor exists and is senior/faculty
   ↓
   Check for duplicate request (compound index: mentorId + menteeId + status:pending)
   ↓
   Validate reason text (length, content)

3. DATABASE OPERATION
   Insert Mentorship document:
   {
     mentorId: senior._id,
     menteeId: junior._id,
     status: "pending",
     reason: "...",
     requestedAt: now()
   }
   ↓
   Index lookup for quick retrieval

4. REAL-TIME NOTIFICATION
   Backend creates Notification document
   ↓
   Emit Socket.io event to mentor (if online):
     EVENT: "mentorship_request_received"
     DATA: {
       from: junior.name,
       reason: "...",
       requestId: mentorship._id
     }
   ↓
   Senior's browser receives real-time notification popup

5. EMAIL NOTIFICATION
   Queue email notification to mentor
   ↓
   Email Service sends:
     Subject: "{junior.name} requested mentorship"
     Body: Includes reason and quick-action links
   ↓
   Mentor receives email (if SMTP configured)

6. FRONTEND UPDATE
   Frontend receives response:
   {
     success: true,
     message: "Mentorship request sent successfully",
     mentorshipId: "...",
     status: "pending"
   }
   ↓
   Show success message to junior
   ↓
   Update UI to show request status

7. JUNIOR VIEWS REQUEST STATUS
   Junior can now see pending request in:
     GET /api/mentorship/my-requests
     ↓
     Response includes all pending requests with mentor details

8. SENIOR RECEIVES & RESPONDS

   A) ACCEPT PATH:
      Senior clicks "Accept" on notification/dashboard
      ↓
      Frontend sends PUT /api/mentorship/{mentorshipId}/accept
      ↓
      Backend updates Mentorship:
      {
        status: "accepted",
        acceptedAt: now()
      }
      ↓
      Create Group document for chat (if not exists)
      ↓
      Add both users to Group.members
      ↓
      Send Socket.io notification to junior: "mentorship_accepted"
      ↓
      Send email to junior: "Your mentorship request was accepted!"
      ↓
      Update both UIs to show active mentorship
      ↓
      Enable chat/messaging functionality

   B) REJECT PATH:
      Senior clicks "Reject" and provides reason
      ↓
      Frontend sends PUT /api/mentorship/{mentorshipId}/reject
      {
        rejectionReason: "Currently overloaded..."
      }
      ↓
      Backend updates Mentorship:
      {
        status: "rejected",
        rejectionReason: "..."
      }
      ↓
      Send Socket.io notification to junior: "mentorship_rejected"
      ↓
      Send email to junior with rejection reason
      ↓
      Update junior's UI to show rejected status
      ↓
      Junior can request from another mentor

9. ANALYTICS LOGGING
   Interaction log (if mentorship accepted):
   - Record mentorship creation as significant interaction
   - Index for analytics queries: mentorId, menteeId, status="accepted", timestamp

10. TRANSACTION COMPLETE
    Mentorship relationship established
    ↓
    Both users can now log interactions
    ↓
    Chat/communication enabled
    ↓
    Analytics data ready for analysis
```

---

## 4.5 Flowchart: Mentorship Lifecycle

### Purpose
Shows all possible states of a mentorship relationship and transitions between them.

### States & Transitions

```
START
  ↓
[1] INITIATION: Request Created
  - Requester: Junior creates request
  - Status: "pending"
  - Event: POST /api/mentorship/request
  - Data stored: mentorId, menteeId, reason, timestamp
  - Notifications sent: Email + Real-time to mentor
  ↓
  Decision: Senior Reviews Request
  ├─────────────────┬──────────────────────┤
  │                 │                      │
  ↓                 ↓                      ↓
[2a] ACCEPTED    [2b] REJECTED      [2c] TIMEOUT
(Approved)      (Declined)         (No response)
  │                 │                    │
  ├─ Update         ├─ Status:          └─ Auto-expire
  │  status:        │  "rejected"       after 30 days
  │  "accepted"     ├─ Store reason     (Optional)
  │                 ├─ Send notification
  │                 └─ Junior can       → Go to [END]
  │                    request another
  │                    mentor
  │
  ├─ Create chat group
  │
  ├─ Send notifications
  │  to both users
  │
  ├─ Enable:
  │  - Interaction logging
  │  - Chat/messaging
  │  - Document sharing
  │
  ↓
[3] ACTIVE: Mentorship Ongoing
  - Status: "accepted"
  - Mentor & Mentee can:
    • Log interactions
    • Send messages
    • Share documents
    • Rate interactions
  - Real-time activity tracking
  - Analytics data collection
  ↓
  Sub-decisions in Active State:
  ├─────────────────┬─────────────────────┤
  │                 │                     │
  ↓                 ↓                     ↓
[3a] Continue    [3b] Terminate        [3c] Check
Activity        Request              Completion
  │                │                    │
  │                ├─ Either party   └─ Automatic
  │                │  can terminate     completion
  │                │  (if policy set)   criteria met
  │                │
  │                ├─ Status:
  │                │  "terminated"
  │                │
  │                ├─ Record end date
  │                │
  │                ├─ Final interaction
  │                │  logs stored
  │                │
  │                └─ Notifications
  │                   sent to both
  │
  ↓
[4] COMPLETED/TERMINATED
  - Status: "terminated" or "completed"
  - Final data:
    • Total interactions logged
    • Total duration
    • Satisfaction ratings
    • Subject tags covered
    • Interaction types used
  - Analytics ready for:
    • Mentor performance metrics
    • Mentee progress analysis
    • Cluster formation
    • Recommendation engine
    • Reporting dashboards
  ↓
  Final Decisions:
  ├─────────────┬──────────────────┤
  │             │                  │
  ↓             ↓                  ↓
[5a] Archive  [5b] Renew         [5c] Review
Data          Mentorship         Analytics
  │             │                  │
  │             ├─ Both parties  ├─ Analyze
  │             │  agree to       │  patterns
  │             │  continue       │
  │             │                 ├─ Generate
  │             ├─ Reset to       │  reports
  │             │  [3] ACTIVE     │
  │             │  state          ├─ Use for
  │             │                 │  clustering/
  │             ↑                 │  recommendations
  │           New Cycle           │
  │                               ↓
  ├───────────────────────────────┤
  │                               │
  └───────────────────────────────┘
              ↓
           [END]
        Mentorship Closed
```

### State Machine Details

**States:**
1. **PENDING** - Awaiting mentor response
   - Duration: Typically 1-7 days
   - Timeout: Auto-expire if no response after 30 days (configurable)

2. **ACCEPTED** - Mentorship approved, active
   - Chat group created
   - Interactions can be logged
   - Real-time messaging enabled

3. **REJECTED** - Mentor declined
   - Request closed
   - Reason stored for analytics
   - Mentee can request from another mentor

4. **ACTIVE** - Ongoing mentorship
   - Multiple interactions logged
   - Communication ongoing
   - Analytics data accumulating

5. **TERMINATED** - Ended by either party
   - Final interaction timestamp recorded
   - Satisfaction ratings finalized
   - Data archived for analysis

**Transitions:**
- PENDING → ACCEPTED (mentor accepts)
- PENDING → REJECTED (mentor rejects)
- PENDING → EXPIRED (timeout after 30 days)
- ACCEPTED → ACTIVE (automatic, same state in implementation)
- ACTIVE → TERMINATED (either party terminates)
- TERMINATED → ARCHIVED (automatic after 7 days)
- ARCHIVED → ANALYTICS (data queried for reports)

**Key Events Triggering State Changes:**
- Mentorship request API call → PENDING
- Accept API call → ACCEPTED
- Reject API call → REJECTED
- Interaction logged → stays in ACTIVE
- Terminate API call → TERMINATED
- 30-day timeout → EXPIRED
- Analytics query → reads from ARCHIVED

---

## 5.1 Proposed System Block Diagram

### Purpose
Shows the major functional modules and their interactions at a high level, depicting data flow and module dependencies.

### Modules & Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    MENTORLINK PLATFORM ARCHITECTURE                 │
└─────────────────────────────────────────────────────────────────────┘

┌─ PRESENTATION LAYER ────────────────────────────────────────────┐
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           Frontend Application (React + Vite)           │  │
│  │                                                          │  │
│  │  • Mentorship Dashboard                               │  │
│  │  • User Profile Management                            │  │
│  │  • Interaction Logging UI                             │  │
│  │  • Discussion Forum                                   │  │
│  │  • Real-time Chat                                     │  │
│  │  • Community Management                               │  │
│  │  • Analytics Dashboard                                │  │
│  │  • Notification Center                                │  │
│  │  • Mobile Responsive Design                           │  │
│  │                                                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓ REST API + WebSocket
┌─────────────────────────────────────────────────────────────────────┐
│               APPLICATION LAYER (Express.js + Node.js)              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─ CROSS-CUTTING CONCERNS ─────────────────────────────────────┐ │
│  │                                                              │ │
│  │  • Security Middleware (Helmet, CORS, Rate Limiting)       │ │
│  │  • Authentication & Authorization (JWT, Role-based)        │ │
│  │  • Input Validation & Sanitization                         │ │
│  │  • Error Handling & Logging                                │ │
│  │  • Request/Response Transformation                         │ │
│  │                                                              │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                           ↓                                        │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │            BUSINESS LOGIC MODULES                           │ │
│  ├─────────────────────────────────────────────────────────────┤ │
│  │                                                             │ │
│  │  ┌─ AUTH MODULE ────────────────────────────────────────┐ │ │
│  │  │ • User registration (institute email validation)    │ │ │
│  │  │ • Login & JWT generation                            │ │ │
│  │  │ • Password reset & email verification              │ │ │
│  │  │ • Token expiry & refresh                            │ │ │
│  │  └─────────────────────────────────────────────────────┘ │ │
│  │                                                             │ │
│  │  ┌─ USER MANAGEMENT MODULE ──────────────────────────────┐ │ │
│  │  │ • Profile creation & editing                         │ │ │
│  │  │ • Skills & interests management                      │ │ │
│  │  │ • CGPA tracking                                      │ │ │
│  │  │ • Mentor/Mentee discovery with filters              │ │ │
│  │  │ • User roles (Junior, Senior, Faculty, Admin)       │ │ │
│  │  │ • Online status tracking                            │ │ │
│  │  └─────────────────────────────────────────────────────┘ │ │
│  │                                                             │ │
│  │  ┌─ MENTORSHIP MODULE ───────────────────────────────────┐ │ │
│  │  │ • Create/manage mentorship requests                  │ │ │
│  │  │ • Accept/reject requests                             │ │ │
│  │  │ • Terminate mentorships                              │ │ │
│  │  │ • Mentorship state transitions                       │ │ │
│  │  │ • Prevent duplicate requests                         │ │ │
│  │  │ • Group chat creation for mentorship                │ │ │
│  │  └─────────────────────────────────────────────────────┘ │ │
│  │                                                             │ │
│  │  ┌─ INTERACTION LOGGING MODULE (★ CRITICAL ★) ──────────┐ │ │
│  │  │ • Record interaction details                         │ │ │
│  │  │   - Topic, subject tag, interaction type             │ │ │
│  │  │   - Duration, satisfaction rating, notes             │ │ │
│  │  │ • Validate interaction data                          │ │ │
│  │  │ • Index for analytics queries                        │ │ │
│  │  │ • Calculate interaction statistics                   │ │ │
│  │  │ • Feed data to recommendation engine                 │ │ │
│  │  └─────────────────────────────────────────────────────┘ │ │
│  │                                                             │ │
│  │  ┌─ DISCUSSION & FORUM MODULE ───────────────────────────┐ │ │
│  │  │ • Create/update discussions                          │ │ │
│  │  │ • Comment on discussions                             │ │ │
│  │  │ • Voting (upvote/downvote)                           │ │ │
│  │  │ • Mark resolution                                    │ │ │
│  │  │ • Subject-based filtering                            │ │ │
│  │  │ • Statistics by subject                              │ │ │
│  │  └─────────────────────────────────────────────────────┘ │ │
│  │                                                             │ │
│  │  ┌─ COMMUNITY & GROUP MODULE ────────────────────────────┐ │ │
│  │  │ • Create communities/groups                          │ │ │
│  │  │ • Add/remove members                                 │ │ │
│  │  │ • Group role management                              │ │ │
│  │  │ • Community categorization                           │ │ │
│  │  │ • Community moderation                               │ │ │
│  │  └─────────────────────────────────────────────────────┘ │ │
│  │                                                             │ │
│  │  ┌─ CHAT & MESSAGING MODULE ─────────────────────────────┐ │ │
│  │  │ • Real-time messaging (Socket.io)                    │ │ │
│  │  │ • Direct & group chat                                │ │ │
│  │  │ • Message history retrieval                          │ │ │
│  │  │ • Attachment handling                                │ │ │
│  │  │ • Read/unread status                                 │ │ │
│  │  │ • Online presence updates                            │ │ │
│  │  └─────────────────────────────────────────────────────┘ │ │
│  │                                                             │ │
│  │  ┌─ NOTIFICATION MODULE ─────────────────────────────────┐ │ │
│  │  │ • Real-time notifications (Socket.io)               │ │ │
│  │  │ • Email notifications (SMTP)                         │ │ │
│  │  │ • In-app notifications                               │ │ │
│  │  │ • Notification preferences management                │ │ │
│  │  │ • Notification history                               │ │ │
│  │  └─────────────────────────────────────────────────────┘ │ │
│  │                                                             │ │
│  │  ┌─ RECOMMENDATION ENGINE ───────────────────────────────┐ │ │
│  │  │ • Skill-based mentor suggestions                     │ │ │
│  │  │ • Peer learning group recommendations                │ │ │
│  │  │ • Topic suggestions based on interaction history     │ │ │
│  │  │ • Clustering algorithm (grouping similar learners)   │ │ │
│  │  │ • Collaborative filtering                            │ │ │
│  │  │ • Interest-based recommendations                     │ │ │
│  │  └─────────────────────────────────────────────────────┘ │ │
│  │                                                             │ │
│  │  ┌─ ANALYTICS & REPORTING MODULE ────────────────────────┐ │ │
│  │  │ • Interaction trend analysis                         │ │ │
│  │  │ • Subject engagement statistics                      │ │ │
│  │  │ • Mentor performance metrics                         │ │ │
│  │  │ • Mentee progress tracking                           │ │ │
│  │  │ • Clustering analysis (grouping students)            │ │ │
│  │  │ • Association rule mining (topics co-occurrence)     │ │ │
│  │  │ • Report generation for faculty/admin                │ │ │
│  │  │ • Time-series analysis                               │ │ │
│  │  └─────────────────────────────────────────────────────┘ │ │
│  │                                                             │ │
│  │  ┌─ FILE UPLOAD & STORAGE MODULE ────────────────────────┐ │ │
│  │  │ • Profile picture upload                             │ │ │
│  │  │ • Document attachment handling                       │ │ │
│  │  │ • Virus/malware scanning (optional)                  │ │ │
│  │  │ • File size validation                               │ │ │
│  │  │ • File type validation                               │ │ │
│  │  │ • URL generation for retrieval                       │ │ │
│  │  └─────────────────────────────────────────────────────┘ │ │
│  │                                                             │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    DATA ACCESS LAYER                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─ ORM/ODM Layer ────────────────────────────────────────────────┐ │
│  │  • Mongoose Schema Definitions                              │ │
│  │  • Query builders                                           │ │
│  │  • Relationship management                                  │ │
│  │  • Validation rules                                         │ │
│  │  • Index management                                         │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                   DATABASE LAYER                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─ MongoDB Atlas (Cloud) ────────────────────────────────────────┐ │
│  │                                                               │ │
│  │  Collections:                                               │ │
│  │  • Users (with indexes on email, role, department, skills) │ │
│  │  • Mentorships (with compound indexes on status, dates)     │ │
│  │  • Interactions (★ Most indexed, for analytics)            │ │
│  │    - Subject, interaction type, timestamp, mentor, mentee   │ │
│  │  • Discussions (indexed on subjectTag, status)              │ │
│  │  • Posts (indexed on author, community)                     │ │
│  │  • Communities (indexed on type, category)                  │ │
│  │  • Groups (indexed on creatorId, members)                   │ │
│  │  • ChatMessages (indexed on groupId, senderId)              │ │
│  │  • Notifications (indexed on recipient, type)               │ │
│  │                                                               │ │
│  │  Replication: Multi-region for high availability           │ │
│  │  Backups: Automated daily snapshots                         │ │
│  │                                                               │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│              EXTERNAL SERVICES & UTILITIES                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─ Email Service ────────────────────────────────────────────────┐ │
│  │  • SMTP configuration (SendGrid/Gmail)                      │ │
│  │  • Email templates                                          │ │
│  │  • Verification emails                                      │ │
│  │  • Notification emails                                      │ │
│  │  • Password reset emails                                    │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌─ Real-time Service (Socket.io) ────────────────────────────────┐ │
│  │  • WebSocket connections                                    │ │
│  │  • Real-time notifications                                  │ │
│  │  • Live chat messaging                                      │ │
│  │  • Online status broadcasts                                 │ │
│  │  • Typing indicators                                        │ │
│  │  • Activity feeds                                           │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌─ File Storage ─────────────────────────────────────────────────┐ │
│  │  • Local /uploads directory                                 │ │
│  │  • AWS S3 (optional, for production)                        │ │
│  │  • Organized by type (profiles, posts, communities)         │ │
│  │  • CDN integration (optional)                               │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌─ Analytics & ML Services ──────────────────────────────────────┐ │
│  │  • Clustering algorithm (KMeans for grouping)               │ │
│  │  • Recommendation engine                                    │ │
│  │  • Data export to warehouse                                 │ │
│  │  • Trend analysis tools                                     │ │
│  │  • Report generation                                        │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Module Interactions

1. **Frontend ↔ Backend**: REST API + WebSocket
2. **Backend ↔ Database**: Mongoose ODM, optimized queries
3. **Backend ↔ Email**: SMTP service for notifications
4. **Backend ↔ Socket.io**: Real-time event broadcasting
5. **Backend ↔ Analytics**: Data queries and report generation
6. **Database ↔ Analytics**: Direct queries for reports and ML

---

## 5.2 Major Modules of the Proposed System

### Detailed Module Breakdown

| Module | Purpose | Key Functions | Inputs | Outputs | Dependencies |
|--------|---------|---------------|--------|---------|--------------|
| **Authentication** | Secure user verification | Register, Login, JWT token generation, Password reset, Email verification | Email, password, OTP code | JWT token, user session | Bcrypt, Email service |
| **User Management** | Profile and account management | Create/update profile, skill management, discovery with filters, role assignment | User data, profile updates, filters | User profile, mentor list, mentee list | Database, Authentication |
| **Mentorship** | Core mentoring relationships | Create request, accept/reject, terminate, status tracking, duplicate prevention | Mentor ID, request reason, acceptance/rejection | Mentorship record, notification | User Management, Notifications |
| **Interaction Logging** | Analytics data collection | Record interactions, validate data, index for queries, calculate stats | Topic, subject tag, type, duration, rating | Interaction record, analytics ready data | Mentorship, Database |
| **Discussion Forum** | Knowledge sharing platform | Create post, comment, vote, resolve, search by subject | Title, content, subject tag, voting preference | Discussion thread, comment thread, statistics | Database, User Management |
| **Community Management** | Group collaboration | Create community, manage members, post content, moderation | Community info, member list, posts | Community record, member list, posts | User Management, Posts |
| **Chat & Messaging** | Real-time communication | Send messages, create group chats, manage history | Message content, recipient/group, attachments | Message record, delivery confirmation | Socket.io, User Management, Groups |
| **Notification System** | User alerts | Real-time notifications, email notifications, preferences | Event type, recipient, message | Notification record, sent confirmation | Socket.io, Email Service |
| **Recommendation Engine** | ML-based suggestions | Suggest mentors, peer groups, topics | User profile, interaction history, skills | Mentor suggestions, group suggestions, topic suggestions | Interaction Logging, User Management, Analytics |
| **Analytics & Reports** | Business intelligence | Generate reports, trend analysis, clustering, subject statistics | Interaction data, time range, parameters | Statistical reports, trend graphs, clusters | Database queries, Interaction data |
| **File Management** | Document handling | Upload files, store, retrieve, validate | File data, file type, user ID | File URL, storage confirmation | Database, File storage service |

---

## 5.3 Technology Stack Diagram

### Purpose
Shows all technologies and frameworks used in the MentorLink platform and how they interact.

### Stack Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                     TECHNOLOGY STACK                             │
│                    MentorLink Platform                           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND LAYER                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  • React 18+ (UI Framework)                                     │
│    └─ Component-based architecture                              │
│    └─ Hooks for state management                                │
│    └─ Context API for global state                              │
│                                                                  │
│  • Vite (Build Tool & Dev Server)                               │
│    └─ Lightning-fast HMR (Hot Module Replacement)               │
│    └─ Optimized production builds                               │
│    └─ ES modules native support                                 │
│                                                                  │
│  • ESLint (Code Quality)                                        │
│    └─ Enforces coding standards                                 │
│    └─ Error detection                                           │
│                                                                  │
│  • Axios/Fetch (HTTP Client)                                    │
│    └─ REST API communication                                    │
│    └─ Interceptors for auth tokens                              │
│                                                                  │
│  • Socket.io Client (Real-time)                                 │
│    └─ WebSocket communication                                   │
│    └─ Real-time updates                                         │
│                                                                  │
│  • CSS3 + Responsive Design                                     │
│    └─ Mobile-first approach                                     │
│    └─ Flexbox/Grid layouts                                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                         ↓ REST API + WebSocket
┌─────────────────────────────────────────────────────────────────┐
│  BACKEND/SERVER LAYER                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  • Node.js (Runtime Environment)                                │
│    └─ Server-side JavaScript execution                          │
│    └─ Event-driven, non-blocking I/O                            │
│    └─ V8 engine for performance                                 │
│                                                                  │
│  • Express.js (Web Framework)                                   │
│    └─ RESTful API development                                   │
│    └─ Middleware support                                        │
│    └─ Routing, error handling                                   │
│                                                                  │
│  • Socket.io (Real-time Communication)                          │
│    └─ WebSocket server                                          │
│    └─ Real-time notifications                                   │
│    └─ Event-based architecture                                  │
│    └─ Fallback to polling if WebSocket unavailable              │
│                                                                  │
│  • Mongoose (ODM - Object Document Mapper)                      │
│    └─ MongoDB schema validation                                 │
│    └─ Pre/post hooks                                            │
│    └─ Query builder                                             │
│    └─ Population (joins)                                        │
│                                                                  │
│  • Bcryptjs (Password Hashing)                                  │
│    └─ Secure password storage                                   │
│    └─ Salt generation                                           │
│    └─ Adaptive hashing (PBKDF2-like)                            │
│                                                                  │
│  • JWT (JSON Web Tokens)                                        │
│    └─ Stateless authentication                                  │
│    └─ Token generation & verification                           │
│    └─ Claims: user ID, role, expiry                             │
│                                                                  │
│  • Helmet.js (Security Headers)                                 │
│    └─ XSS protection                                            │
│    └─ CSRF protection                                           │
│    └─ Content Security Policy                                   │
│    └─ Clickjacking protection                                   │
│                                                                  │
│  • Express Rate Limiter                                         │
│    └─ Request rate limiting                                     │
│    └─ DDoS protection                                           │
│    └─ Endpoint-specific limits                                  │
│                                                                  │
│  • Express Validator                                            │
│    └─ Input validation                                          │
│    └─ Data sanitization                                         │
│    └─ Error collection                                          │
│                                                                  │
│  • Nodemailer (Email Service)                                   │
│    └─ SMTP client                                               │
│    └─ Email sending                                             │
│    └─ Template support                                          │
│                                                                  │
│  • CORS (Cross-Origin Resource Sharing)                         │
│    └─ Cross-origin requests                                     │
│    └─ Preflight handling                                        │
│    └─ Credentials support                                       │
│                                                                  │
│  • Dotenv (Environment Variables)                               │
│    └─ Configuration management                                  │
│    └─ Sensitive data handling                                   │
│    └─ Environment-specific settings                             │
│                                                                  │
│  • HTTP (Node.js built-in)                                      │
│    └─ HTTP server creation                                      │
│    └─ Request/response handling                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                         ↓ MongoDB Protocol
┌─────────────────────────────────────────────────────────────────┐
│  DATABASE LAYER                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  • MongoDB Atlas (Cloud Database)                               │
│    └─ Document-based NoSQL database                             │
│    └─ JSON-like document structure (BSON)                       │
│    └─ Collections instead of tables                             │
│    └─ Flexible schema                                           │
│    └─ Multi-region replication                                  │
│    └─ Automatic backups                                         │
│    └─ Built-in security (IP whitelisting, encryption)           │
│                                                                  │
│  • MongoDB Collections:                                         │
│    └─ Users, Mentorships, Interactions, Discussions             │
│    └─ Posts, Communities, Groups, ChatMessages                  │
│    └─ Notifications, and more                                   │
│                                                                  │
│  • Indexing:                                                    │
│    └─ Single indexes on frequently queried fields               │
│    └─ Compound indexes for complex queries                      │
│    └─ Text indexes for search                                   │
│    └─ TTL indexes (for auto-expiring documents)                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  DEVELOPMENT & DEVOPS TOOLS                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  • npm (Package Manager)                                        │
│    └─ Dependency management                                     │
│    └─ Script execution                                          │
│    └─ Version management                                        │
│                                                                  │
│  • Git (Version Control)                                        │
│    └─ Source code management                                    │
│    └─ Collaboration                                             │
│    └─ History tracking                                          │
│                                                                  │
│  • GitHub (Repository Hosting)                                  │
│    └─ Remote repository                                         │
│    └─ Pull requests, code review                                │
│    └─ CI/CD integration (optional)                              │
│                                                                  │
│  • Postman/Insomnia (API Testing)                               │
│    └─ API endpoint testing                                      │
│    └─ Request collection                                        │
│    └─ Documentation generation                                  │
│                                                                  │
│  • VS Code (Editor)                                             │
│    └─ Code development                                          │
│    └─ Debugging                                                 │
│    └─ Extensions ecosystem                                      │
│                                                                  │
│  • Node Monitor (PM2) - Optional                                │
│    └─ Process management                                        │
│    └─ Cluster mode                                              │
│    └─ Log management                                            │
│                                                                  │
│  • Docker - Optional                                            │
│    └─ Containerization                                          │
│    └─ Deployment consistency                                    │
│    └─ Microservices (future)                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  EXTERNAL SERVICES & APIS                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  • SMTP (Email Service)                                         │
│    └─ Gmail SMTP / SendGrid                                     │
│    └─ Email delivery                                            │
│    └─ Template rendering                                        │
│                                                                  │
│  • File Storage                                                 │
│    └─ Local file system (/uploads)                              │
│    └─ AWS S3 (optional)                                         │
│    └─ Azure Blob Storage (optional)                             │
│                                                                  │
│  • Analytics (Optional Future)                                  │
│    └─ Google Analytics                                          │
│    └─ Custom analytics engine                                   │
│    └─ Clustering algorithms                                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  TESTING & QUALITY ASSURANCE                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  • Jest (Unit Testing) - Optional                               │
│    └─ Test framework                                            │
│    └─ Mock support                                              │
│    └─ Coverage reporting                                        │
│                                                                  │
│  • Supertest (API Testing) - Optional                           │
│    └─ HTTP assertions                                           │
│    └─ API endpoint testing                                      │
│                                                                  │
│  • Mocha/Chai - Optional                                        │
│    └─ BDD-style testing                                         │
│    └─ Assertion library                                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Choices Rationale

| Technology | Reason |
|-----------|--------|
| **Node.js + Express** | Fast, scalable, JavaScript full-stack, event-driven |
| **MongoDB** | Flexible schema for varied interaction data, scales horizontally |
| **Socket.io** | Real-time features (chat, notifications), fallback support |
| **React + Vite** | Modern UI, fast development, great ecosystem |
| **Mongoose** | Data validation, relationships, schema enforcement |
| **JWT** | Stateless authentication, scalable, secure |
| **Helmet + Rate Limiting** | Security best practices, DDoS protection |
| **Bcryptjs** | Industry-standard password hashing |

---

## Integration Points

### Frontend ↔ Backend
- **Protocol**: HTTP/REST for data, WebSocket for real-time
- **Authentication**: JWT in Authorization header
- **Format**: JSON request/response

### Backend ↔ Database
- **Driver**: Mongoose with native MongoDB driver
- **Query Style**: MongoDB query language, Mongoose chainable methods
- **Connection**: MongoDB Atlas connection string via env variable

### Backend ↔ External Services
- **Email**: SMTP protocol to SendGrid/Gmail
- **File Storage**: Local filesystem or cloud SDKs
- **Socket.io**: WebSocket protocol to browsers

---

## Performance Considerations

- **Caching**: Implement Redis for session/token caching (future)
- **Database Indexing**: Strategic indexes on frequently queried fields
- **API Response Time**: Target < 200ms for 95% of requests
- **WebSocket Scalability**: Use Redis adapter for Socket.io across multiple servers
- **CDN**: Use for static assets in production
- **Load Balancing**: Multiple Node.js instances behind load balancer (nginx/HAProxy)

---

## Deployment Architecture (Future)

```
Internet
  ↓
CDN (CloudFront/Cloudflare)
  ↓
Load Balancer (Nginx/HAProxy)
  ↓
Node.js Server Cluster (multiple instances)
  ↓
Shared Session Store (Redis)
  ↓
MongoDB Atlas (replicated)
  ↓
File Storage (S3/Cloud Storage)
```

---

## Summary

MentorLink uses a modern, scalable technology stack designed for:
- **Rapid Development**: Express + React ecosystem
- **Real-time Features**: Socket.io for live updates
- **Data Integrity**: Mongoose validation and MongoDB transactions
- **Security**: Industry-standard practices (bcrypt, JWT, Helmet)
- **Analytics Ready**: Structured data, optimized indexes, MongoDB for flexible analytics

This stack supports current requirements and future scaling to handle institutional growth.

---

