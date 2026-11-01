# MentorLink: Final Project Documentation

**Status:** Current implementation and verified behavior
**Last updated:** 2026-10-13

This document is the consolidated source of truth for MentorLink's product scope, architecture, feature behavior, certificate module, External-user restrictions, testing status, and remaining work.

## 1. Project Overview

MentorLink is an institute-focused mentorship and academic interaction platform. It connects students, seniors, faculty, alumni, and approved External users through verified authentication, mentor discovery, mentorship requests, communities, discussions, posts, notifications, and analytics-ready interaction logging.

The platform has two distinct account experiences:

- **Institute Member:** Can offer mentorship, mentor users, record mentoring outcomes, earn achievements, and receive certificates.
- **External User:** Can seek mentorship and browse approved content, but cannot mentor others or access mentor-recognition features.

## 2. Technology Architecture

| Layer | Technology |
|---|---|
| Frontend | Static HTML, CSS, JavaScript in `public/` |
| Landing application | React, Vite, Tailwind |
| Backend | Node.js and Express |
| Database | MongoDB with Mongoose |
| Authentication | Email OTP, bcrypt, JWT |
| Email | Nodemailer through SMTP |
| Realtime | Socket.IO |
| Uploads | Multer |
| Security | Helmet, CORS, rate limiting, express-validator |
| Recommendation logic | JavaScript scoring, clustering, Python helpers |

Runtime flow:

```text
Browser pages
    -> Express REST APIs
    -> Authentication and validation middleware
    -> Route handlers
    -> Mongoose models
    -> MongoDB

Express -> Nodemailer SMTP
Browser <-> Socket.IO for realtime events
```

The active application served by `server.js` is the `public/` tree. The React/Vite application currently provides the landing experience.

## 3. Authentication and Account Types

### Institute Members

- Register as Current Student or Alumni.
- Current students must use an approved SPIT email address.
- Complete email OTP verification.
- Use JWT authentication after verification.
- Can be juniors, seniors, faculty, or administrators.
- Seniors/faculty may offer mentorship.

### External Users

- Register with a general email address.
- Verify email through OTP.
- Complete optional external profile enrichment.
- Are permanently restricted to `seeking` mentorship intent.
- Cannot become mentors through profile updates.

## 4. Institute Member Features

Institute Members can use:

- Feed and personal posts
- Media uploads
- Communities and community posts
- Community creation and moderation where authorized
- Messages and group chat
- Private mentorship chat after request acceptance
- Mentor discovery and recommendations
- Mentorship requests
- Interaction logging and confirmation
- Hybrid contribution scoring
- Achievement levels
- Formal certificates
- Profile achievement section
- Notifications and realtime events

## 5. External User Features

External users retain:

- Feed browsing
- Media browsing
- Community browsing
- Joining communities open to External users
- Mentor discovery
- Mentor recommendations
- Outgoing mentorship requests
- Request status and notifications
- Profile editing for permitted external fields
- External profile identity badge

External users cannot access:

- Achievements
- Mentor Achievements profile section
- Contribution points
- Certificates
- Messages
- Standalone groups
- Private mentorship chat
- Mentor interaction logging
- Incoming mentorship request management
- Offering or Both mentorship intent
- Community creation
- Community moderation
- Personal profile posting

The interface displays `External User` and `Seeking Mentorship` on External profiles.

Server-side restrictions also enforce these rules; hiding UI controls is not the only protection.

## 6. Mentorship Workflow

```text
User discovers mentor
    -> Sends mentorship request
    -> Mentor accepts or rejects
    -> Accepted request creates private mentorship chat
    -> Mentoring session is logged
    -> Mentee confirms the session
    -> Contribution events are awarded
    -> Achievement threshold is evaluated
    -> Certificate is issued if eligibility gates pass
```

External users may send requests but cannot accept requests or act as mentors.

## 7. Interaction and Evidence Model

An interaction stores:

- Mentor
- Mentee
- Mentorship relationship
- Topic and subject
- Interaction type
- Duration
- Satisfaction rating
- Outcome status
- Mentee recommendation response
- Follow-up completion
- Confirmation status
- Confirmation timestamp
- Notes and timestamps

An interaction starts as `pending`. Only the mentee can confirm it. Unconfirmed interactions do not award certificate points.

Relevant models:

- `models/Interaction.js`
- `models/Mentorship.js`
- `models/ContributionEvent.js`
- `models/Achievement.js`
- `models/Certificate.js`

## 8. Hybrid Mentoring Impact Scoring

Mentor recognition is based on verified mentoring impact rather than request volume alone.

### Scoring dimensions

1. **Verified activity:** confirmed session and capped duration contribution.
2. **Feedback quality:** satisfaction rating and recommendation response.
3. **Outcome evidence:** whether the mentee marks the goal as resolved.
4. **Follow-through and reach:** follow-up completion and first-time mentees helped.

### Current event weights

| Evidence | Points |
|---|---:|
| Confirmed activity | 6-10, capped by duration |
| Satisfaction rating | 0-10 based on rating |
| Resolved outcome | 10 |
| Completed follow-up | 5 |
| First confirmed session with a unique mentee | 5 |

Every point is stored as an auditable `ContributionEvent` tied to an interaction.

## 9. Achievement Levels

| Level | Certificate title | Points | Sessions | Mentees | Resolved outcomes | Rating |
|---:|---|---:|---:|---:|---:|---:|
| 1 | Helpful Contributor | 50 | 3 | 2 | 1 | 4+ |
| 2 | Peer Mentor | 150 | 8 | 3 | 3 | 4+ |
| 3 | Trusted Mentor | 300 | 15 | 5 | 6 | 4+ |
| 4 | Mentor Champion | 600 | 30 | 8 | 12 | 4+ |
| 5 | Mentor Excellence Award | 1000 | 50 | 12 | 20 | 4+ |

All requirements must be satisfied. A mentor cannot unlock a certificate through session volume alone.

## 10. Certificate Module

Certificates are created once per earned achievement level.

Each certificate includes:

- Mentor name
- Achievement title
- Verified points
- Confirmed sessions
- Mentees helped
- Average rating
- Issue date
- Certificate ID
- Public verification link

The certificate is presented as a formal printable certificate with:

- MentorLink branding
- Certificate of Recognition heading
- Decorative border
- Recipient name
- Achievement distinction
- Evidence summary
- Verification information

### Certificate delivery

When a new certificate is first issued:

1. A certificate record is saved in MongoDB.
2. An SMTP email is sent through Nodemailer.
3. The email includes achievement details.
4. A formal certificate HTML attachment is included.
5. The certificate appears in the member's profile and Achievements page.

External users cannot access certificate APIs.

## 11. Achievement and Certificate Endpoints

```text
GET  /api/achievements/me
GET  /api/achievements/certificates/:certificateId/view
GET  /api/achievements/certificates/:certificateId/download
GET  /api/achievements/certificates/verify/:certificateId
POST /api/interactions/:id/confirm
```

The `view` and public verification routes are suitable for browser links. Certificate download requires authentication and ownership or administrator access.

## 12. User Interface

### Achievements page

`public/achievements.html` provides:

- Contribution points
- Confirmed sessions
- Mentees helped
- Average rating
- Resolved outcomes
- Follow-ups
- Recommendation rate
- Progress toward the next level
- All unlocked and locked achievement levels
- `View certificate` action for earned levels

### Profile page

Institute Member profiles show a separate Mentor Achievements section with:

- Contribution points
- Mentees helped
- Confirmed sessions
- Average rating
- Next achievement
- Earned certificates
- View certificate action

External profiles hide this section and show `External User`.

## 13. Communities

External users may browse and join communities where `allowExternal` is enabled. They cannot:

- Create communities
- Become owners
- Moderate communities
- Edit community settings
- Manage moderators

Disallowed community records are hidden through request-time access checks.

## 14. Recommendation System

Mentor recommendations use profile and interaction signals, including:

- Skills and interests
- Department
- Academic year
- Availability
- CGPA
- Profile strength
- Interaction count
- Satisfaction
- Mentorship statistics
- Subject breadth
- Activity recency
- Cluster fit

External recommendations are restricted to eligible, opted-in senior or faculty mentors under the current academic-year rules.

## 15. Verification and Testing Evidence

The implementation has been checked through:

- Node syntax checks
- VS Code diagnostics
- Module loading smoke tests
- MongoDB Atlas connection
- Browser rendering checks
- Public certificate verification
- Authenticated certificate retrieval
- Certificate download response
- Chetan Institute Member end-to-end test
- External-user browser navigation test
- External API restriction matrix

### Verified Chetan test result

- 109 contribution points
- 3 confirmed sessions
- 2 mentees helped
- 3 resolved outcomes
- 3 follow-ups
- 5.0/5 average rating
- 100% recommendation rate
- Achievement: Helpful Contributor
- Certificate ID: `ML-2026-EA853FAE`

### Verified API matrix

| Check | Result |
|---|---:|
| Chetan authentication | 200 |
| Chetan achievements | 200 |
| Certificate verification | 200 |
| External achievements | 403 |
| External groups | 403 |
| External chat | 403 |
| External community browsing | 200 |

## 16. Synthetic Testing

Run the certificate simulation with:

```bash
npm run certificate:simulate -- mentor@example.com
```

The script creates synthetic confirmed sessions for a selected mentor, evaluates the hybrid score, creates an achievement and certificate when eligible, and prints the resulting records.

Use only a deliberate test account or test database for simulation data.

## 17. Documentation and Source Files

This consolidated document combines the intent of:

- `docs/PRD.md`
- `docs/architecture.md`
- `docs/features.md`
- `docs/tasks.md`
- `PROJECT_REPORT_INFORMATION.md`

Primary implementation files:

- `server.js`
- `routes/auth.js`
- `routes/mentorship.js`
- `routes/interactions.js`
- `routes/achievements.js`
- `routes/users.js`
- `routes/communities.js`
- `routes/groups.js`
- `routes/chat.js`
- `utils/contributionService.js`
- `utils/sendEmail.js`
- `models/Interaction.js`
- `models/ContributionEvent.js`
- `models/Achievement.js`
- `models/Certificate.js`
- `public/achievements.html`
- `public/profile.html`
- `scripts/simulate-certificate.js`

## 18. Known Limitations

These items are outside the completed feature work or remain future improvements:

- Root automated test script is not yet implemented.
- Pending registration storage is still in process memory.
- Legacy authentication pages and API dashboard remain for compatibility.
- Full administrative certificate revocation and audit UI is future work.
- External peer recommendations, calls, and groups remain deferred.
- SMTP delivery acceptance was verified through Nodemailer; external inbox receipt requires checking the configured mailbox.

## 19. Final Status

The certificate and achievement module, hybrid mentoring-impact model, SMTP delivery path, Institute Member recognition UI, External seeking-only interface, profile labels, community access rules, and backend restrictions are implemented and cross-checked.

For future updates, edit this file first and then synchronize the narrower PRD, architecture, feature, or task documents when needed.
