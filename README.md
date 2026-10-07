# MentorLink

MentorLink is an institute-focused mentoring and academic collaboration platform. It connects junior students with senior students and faculty, supports structured mentorship and discussion, and provides analytics-ready data for academic decision-making.

The repository contains both sides of the application:

- **Backend:** Node.js, Express, MongoDB/Mongoose, JWT authentication, email verification, REST APIs, uploads, notifications, chat, and Socket.IO real-time features.
- **Frontend:** React and Vite landing experience, together with the authenticated HTML pages served by the backend from `public/`.

## What the platform provides

- Institute-restricted registration and email/OTP verification.
- Role-based accounts for juniors, seniors, faculty, and administrators.
- Academic profiles with skills, interests, department, year, CGPA, bio, projects, and mentorship intent.
- Mentor discovery, mentorship requests, acceptance/rejection, and termination.
- Structured interaction logging with topics, subject tags, duration, satisfaction, and notes.
- Subject-based discussions, comments, voting, and resolved-question tracking.
- Communities, groups, posts, chat, notifications, and online activity.
- Mentor recommendations and analytics-ready data for future data mining.
- External Guidance consent for mentors, with terms/version and academic-year controls.
- Security controls including password hashing, JWT protection, role checks, rate limiting, Helmet headers, validation, and sanitization.

## Current progress

The core MentorLink application is implemented across the backend and frontend. The following features are currently completed in the repository:

### Completed features

- **Authentication and account access:** institute-domain registration, OTP/email verification, login, JWT sessions, logout, forgot-password, and reset-password flows.
- **Role-based access:** junior, senior, faculty, and admin roles with protected routes and permission checks.
- **Profiles:** profile creation and editing, academic information, skills, interests, bio, projects, CGPA, profile pictures, profile-strength information, and mentorship intent.
- **Mentorship:** mentor discovery, filtering/search, mentorship requests, accept/reject actions, active mentorships, termination, and duplicate-request prevention.
- **External Guidance:** mentor opt-in consent, terms-version tracking, academic-year locking, institute-only visibility controls, and admin summary information.
- **Interactions and analytics data:** structured mentoring interactions, filters, statistics, timestamps, indexes, and data suitable for recommendations and reporting.
- **Discussion forum:** subject-tagged discussions, comments, voting, resolve/unresolve actions, and subject-wise statistics.
- **Social collaboration:** posts, communities, groups, group membership, comments/reactions, uploads, and online activity.
- **Real-time communication:** Socket.IO-based chat, typing/online indicators, and notifications.
- **Recommendations:** mentor recommendation workflows and multi-factor/ML recommendation support.
- **Security and reliability:** password hashing, JWT validation, Helmet headers, CORS, rate limiting, input validation/sanitization, centralized error handling, and MongoDB connection checks.
- **User interfaces:** React/Vite landing page plus backend-served login, registration, verification, profile, dashboard, discussion, community, group, chat, notification, and admin pages.
- **Project documentation and utilities:** API documentation, architecture/product documents, setup scripts, upload backup/import tools, test-user setup, and synthetic data utilities.

### Remaining or planned work

The core feature set is complete, but the following areas remain for project hardening and future releases:

- Automated unit, integration, and end-to-end test coverage.
- Production deployment configuration and a documented supported environment matrix.
- Performance testing and optimization under realistic traffic.
- Expanded analytics dashboards and production data-export/ETL pipelines.
- Additional product workflows documented as planned, such as guide directories, guide pledges, reviews/remarks, and a dedicated admin-management interface.

These items are improvements around the completed platform rather than blockers for the core mentoring workflow. See [COMPLETE_FEATURE_INVENTORY.md](./COMPLETE_FEATURE_INVENTORY.md) and [docs/PRD.md](./docs/PRD.md) for the detailed feature-level status.

## Architecture

```text
Browser
  ├── React/Vite landing page (frontend/)
  └── Authenticated HTML pages (public/)
          │
          ▼
Node.js + Express + Socket.IO (server.js)
          │
          ├── REST API (/api/...)
          ├── Uploaded files (public/uploads/)
          └── MongoDB / MongoDB Atlas
```

The backend serves the static pages in `public/` and exposes the API under `/api`. The React frontend is developed independently with Vite and uses `VITE_API_URL` to know where the backend is running. In local development, the usual backend URL is `http://localhost:5000`.

## Repository structure

```text
MentorLink/
├── config/             MongoDB and application configuration
├── controllers/        Request and business-logic handlers
├── middleware/         Authentication, validation, security, and errors
├── models/             Mongoose schemas and data models
├── routes/             REST API route modules
├── realtime/           Socket.IO event handling
├── scripts/            Administrative, setup, email, and data utilities
├── services/           Shared application services
├── utils/              Upload and other shared helpers
├── public/              Authenticated HTML pages and uploaded assets
├── frontend/            React/Vite frontend application
├── docs/                Product, design, architecture, and task documentation
├── server.js            HTTP server and route registration
└── package.json         Backend scripts and dependencies
```

## Prerequisites

- Node.js 18 or later
- npm
- MongoDB locally or a MongoDB Atlas cluster
- An SMTP account if email verification or password-reset emails are required

## Environment configuration

Copy the example environment file and update it for your machine:

```bash
cp .env.example .env
```

Important backend variables include:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/mentorlink
JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRE=7d
ALLOWED_DOMAINS=spit.ac.in
```

Configure the SMTP variables in `.env` when using OTP verification, welcome emails, or password reset. Never commit `.env` or real credentials.

## Installation

Install backend dependencies from the repository root:

```bash
npm install
```

Install frontend dependencies:

```bash
cd frontend
npm install
cd ..
```

## Running the application

Start MongoDB first, then run the backend from the repository root:

```bash
npm start
```

The API and static application are available at `http://localhost:5000`.

In a second terminal, start the React/Vite frontend:

```bash
npm run dev
```

The root `dev` script starts the Vite frontend through `frontend/`. Vite normally serves it at `http://localhost:5173`. To use another backend URL, create `frontend/.env` with:

```env
VITE_API_URL=http://localhost:5000
```

For a production frontend build:

```bash
cd frontend
npm run build
npm run preview
```

## Backend API overview

The main API areas are:

| Area | Prefix | Purpose |
| --- | --- | --- |
| Authentication | `/api/auth` | Registration, OTP verification, login, profile session, and password reset |
| Users | `/api/users` | Profiles, mentor/junior discovery, search, profile pictures, and external guidance |
| Mentorship | `/api/mentorship` | Requests, approvals, active mentorships, and termination |
| Interactions | `/api/interactions` | Structured mentoring activity and statistics |
| Discussions | `/api/discussions` | Posts, comments, votes, resolution, and subject statistics |
| Posts | `/api/posts` | Community posts and post interactions |
| Communities | `/api/communities` | Community membership and content |
| Groups | `/api/groups` | Group creation, membership, and group activity |
| Chat | `/api/chat` | Conversations and messages |
| Notifications | `/api/notifications` | User notifications |
| Recommendations | `/api/recommendations` | Mentor recommendation data and results |
| Health | `/api/health` | Server health check |

See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for request and response details.

## Frontend overview

The frontend is split into two related surfaces:

1. **React/Vite landing page (`frontend/`)**
   Provides the current public landing experience, navigation, and links into the application.
2. **Authenticated application pages (`public/`)**
   Includes login, registration, OTP verification, profile setup, home/dashboard, profiles, discussions, communities, groups, chat, and admin/API views. These pages are served by the Express server.

The frontend stores the authenticated JWT in the browser and sends it to protected API endpoints. Keep the backend running while developing or testing either frontend surface.

## Data and analytics

MongoDB models use references and timestamps to preserve relationships between users, mentorships, interactions, discussions, posts, groups, and communities. Interaction records are intentionally structured for:

- Mentor and mentee activity reporting.
- Subject and interaction-type trends.
- Mentor recommendation and matching workflows.
- Clustering and other data-mining experiments.
- Export or ETL into analytical storage.

Supporting data-generation and analysis utilities are available in `scripts/`.

## Useful commands

| Command | Description |
| --- | --- |
| `npm start` | Start the backend and static application |
| `npm run dev` | Start the React/Vite frontend |
| `npm run atlas:check` | Check MongoDB Atlas reachability |
| `npm run admin:create-first` | Create the first administrator |
| `npm run users:setup-test` | Set up test users |
| `npm run uploads:import` | Import backed-up uploads |
| `npm run uploads:backup` | Back up uploads |
| `cd frontend && npm run lint` | Lint the React frontend |
| `cd frontend && npm run build` | Build the React frontend |

## Documentation

- [API documentation](./API_DOCUMENTATION.md)
- [Complete feature inventory](./COMPLETE_FEATURE_INVENTORY.md)
- [Architecture documentation](./docs/architecture.md)
- [Product requirements](./docs/PRD.md)
- [Frontend README](./frontend/README.md)
- MongoDB Atlas connectivity can be checked with `npm run atlas:check`.

## License
