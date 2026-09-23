# Feature Walkthroughs

Purpose: Describe how the major current features work from the user's perspective and through the backend.

Last updated: 2026-09-23

## Authentication

### Register and verify email

**User flow**

1. Open `register.html`.
2. Select External or Institute Member.
3. If Institute Member, select Current Student or Alumni.
4. Enter required identity, email, academic, and password fields.
5. Optionally enter External admission information.
6. Submit the form.
7. Receive an email OTP.
8. Enter the OTP in the modal.
9. External users continue to `complete-external-profile.html`; Institute Members continue directly to `home.html`.
10. External users may save profile enrichment or choose `Skip for now`; either action leads to `home.html`.

**Technical flow**

- `register.html` sends JSON to `POST /api/auth/register`.
- `routes/auth.js` validates the selected identity and stores the payload in `pendingRegistrations`.
- Nodemailer sends the OTP.
- `register.html` sends the email and OTP to `POST /api/auth/verify-otp`.
- The route creates a `User` document with `isVerified: true` and `profileComplete: true`.
- `models/User.js` hashes the password in its `pre('save')` hook.
- The route returns a seven-day JWT; the browser stores it in `localStorage.mentorlink_token`.
- For External users, the browser redirects to `complete-external-profile.html` with that token already stored.
- The External page sends multipart data with the Bearer token to `POST /api/auth/external-profile`.
- That route updates only profile picture, bio, mentorship intent, availability, interests, skills, project link, and GitHub URL.
- Mentorship intent and availability are required on submit; the entire step is skippable.
- Institute Member verification and redirect behavior are unchanged.

### Login

**User flow**

1. Open `login.html`.
2. Select External or Institute Member.
3. Enter email and password.
4. Submit.
5. Admins go to `dashboard.html`; other users go to `home.html`.

**Technical flow**

- `login.html` sends `POST /api/auth/login`.
- The route loads the password with `.select('+password')`.
- It checks account type, active state, verification, and `profileComplete`.
- `comparePassword()` checks bcrypt.
- A JWT is returned and later sent in `Authorization: Bearer` headers.

### Legacy Profile Setup

**User flow**

The old page asks for password, profile picture, names, bio, mentorship preferences, skills, interests, projects, CGPA, and links.

**Technical flow**

- `profile-setup.html` requires `sessionStorage.verifyEmail`.
- It submits multipart form data to `POST /api/auth/complete-profile`.
- The route updates a verified incomplete user, sets `profileComplete: true`, and returns a JWT.
- The active registration path bypasses this page.

Status: `⚠️ Legacy (needs cleanup)`.

## Profiles

**User flow**

1. Open the profile view from the authenticated application.
2. Inspect name, role, academic data, skills, interests, availability, projects, and CGPA.
3. Edit supported profile fields.
4. Save changes.

**Technical flow**

- `GET /api/auth/me` returns the current authenticated user summary.
- `GET /api/users/profile/:id` returns a detailed profile and mentor statistics where applicable.
- Profile updates use the `/api/users/profile` route family and `findByIdAndUpdate` with validators.
- Editable fields include name, year, department, skills, interests, CGPA, bio, projects, mentorship intent, availability, and links.
- Password and account identity fields are not part of the normal profile update payload.

## Mentorship

**User flow**

1. Browse a user or mentor context.
2. Send a mentorship request.
3. The recipient reviews incoming requests.
4. The recipient accepts or rejects.
5. Accepted relationships can be viewed and later terminated.

**Technical flow**

- `routes/mentorship.js` persists `Mentorship` documents.
- Requests and relationship queries use `verifyToken` and ownership/participant checks.
- User data is populated with legacy `role`, year, department, profile picture, skills, and interests as needed.
- Mentor/mentee permission helpers rely on `User.role` values, not `userType` alone.

## Posts and discussions

**User flow**

- Users create feed posts, optionally with images, then like, comment, or delete permitted content.
- Users create discussions, comment, vote, and mark discussions resolved where supported.

**Technical flow**

- Posts use `models/Post.js` and `routes/posts.js`.
- Discussions use `models/Discussion.js` and `routes/discussions.js`.
- Uploads are handled through Multer and served under `/uploads`.
- Author data is populated with public profile fields such as name, department, year, role, and profile picture.

## Communities and groups

**User flow**

- Users browse or create communities, manage membership, and interact with community content.
- Users create or join groups, where group membership has separate owner/admin/member roles.

**Technical flow**

- Communities use `models/Community.js` and `routes/communities.js`.
- Groups use `models/Group.js` and `routes/groups.js`.
- Group member `role` is a relationship role and must not be confused with `User.role`.

## Chat and notifications

**User flow**

- Users send and read group messages, see typing/presence behavior, and receive notifications for relevant activity.

**Technical flow**

- Persisted messages use `models/ChatMessage.js` and `routes/chat.js`.
- Socket.IO in `realtime/socket.js` handles JWT-authenticated rooms, typing, online status, and call signaling.
- Notifications use `models/Notification.js` and `routes/notifications.js`.

## Recommendations

**User flow**

1. Open mentor or peer recommendation views.
2. Review ranked people and compatibility explanations.
3. Use the result as a discovery aid before requesting mentorship or connecting.

**Technical flow**

- Mentor recommendations use `GET /api/recommendations/mentors`.
- The route filters active users by offering/both mentorship intent and applies role/year eligibility.
- `utils/recommendationEngine.js` builds features from skills, interests, year, CGPA, profile strength, availability, department, and interaction analytics.
- Peer matching uses `recommender_model/src/peerMatcher.js` through user routes.
- External users may lack year/department data, so recommendation behavior for them is not equivalent to institute users.

## Admin and operations

**User flow**

- An existing admin can create another admin through the protected endpoint.
- The first admin is created with the bootstrap script.
- Admin login redirects to `dashboard.html`.

**Technical flow**

- `POST /api/auth/create-admin` uses `verifyToken` and `checkRole('admin')`.
- `scripts/create-first-admin.js` creates the initial completed, verified admin.
- The dashboard currently appears to be a partial/admin-oriented interface rather than a complete administration system.

## Legacy API Dashboard

`api-dashboard.html` is a manual API testing surface. Its registration widget expects an older response with an immediate token and performs client-side SPIT-only validation. It is not a reliable representation of the active registration contract.
