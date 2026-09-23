# Product Requirements Document

Purpose: Describe the problem MentorConnect solves, its audience, product approach, and current feature scope.

Last updated: 2026-09-23

## Product Snapshot

MentorConnect connects students, alumni, faculty, and external users around academic guidance, peer interaction, mentorship requests, communities, discussions, and project-oriented networking. The project is in active development; route and model evidence is more authoritative than completion claims in older project reports.

## Problem

Students often need guidance that is specific to their branch, year, interests, and lived campus experience. Existing conversations are fragmented across informal channels, while mentors lack a structured way to offer help, manage requests, and build context around interactions.

MentorConnect aims to provide one authenticated place for:

- Finding relevant peers and mentors.
- Requesting and managing mentorship.
- Sharing posts, projects, and discussions.
- Joining communities and groups.
- Using academic/profile context to improve matching.

## Audience

- Current students seeking academic, project, placement, or campus guidance.
- Alumni who may participate as experienced community members or mentors.
- Faculty who may act as mentors or administrators.
- External users who can register with general email addresses and provide optional admission context.
- Administrators who manage protected platform operations.

## Motivation

The product combines identity, structured academic context, social interaction, and mentorship analytics so that guidance can become easier to discover, request, and evaluate without forcing every user into the same profile or identity path.

## Product Approach

1. Verify account ownership through email OTP.
2. Preserve a simple account-type identity: External or Institute Member.
3. Keep legacy mentorship authorization separate through the existing `role` field.
4. Use profiles, interactions, availability, interests, skills, year, and department as context for matching.
5. Let the main application serve as the normal destination after authentication.

## Feature Scope

### Authentication and identity

| Feature | Status |
|---|---|
| External / Institute Member registration selector | `✅ Live` |
| Current Student / Alumni institute identity | `✅ Live` |
| External registration with normal email domains | `✅ Live` |
| SPIT email restriction for current students | `✅ Live` |
| Email OTP verification | `✅ Live` in the primary flow |
| Bcrypt password hashing | `✅ Live` |
| JWT authentication with seven-day expiry | `✅ Live` |
| Legacy token email verification | `⚠️ Legacy (needs cleanup)` |
| Legacy standalone OTP page and resend behavior | `⚠️ Legacy (needs cleanup)` |
| Consolidated authentication flow | `🚧 In Progress` |

### Profiles and identity data

| Feature | Status |
|---|---|
| User name, academic identity, and account status | `✅ Live` |
| Editable profile fields | `✅ Live` |
| Skills, interests, bio, projects, links, and profile picture | `✅ Live` |
| Mentorship intent and availability | `✅ Live` |
| Optional External admission information | `✅ Live` in registration storage/schema |
| Profile strength and completion reporting | `✅ Live` |
| One unified profile/onboarding experience | `🚧 In Progress` |
| Mandatory legacy Profile Setup page | `⚠️ Legacy (needs cleanup)` |

### Mentorship and matching

| Feature | Status |
|---|---|
| Mentorship requests and active relationships | `✅ Live` |
| Accept, reject, and terminate mentorship relationships | `✅ Live` |
| Interaction logging and statistics | `✅ Live` |
| Mentor recommendations | `✅ Live` |
| Peer recommendations and compatibility logic | `✅ Live` |
| Recommendation quality for External users without academic fields | `🚧 In Progress` |
| Guide directory or guide pledge workflow | `📋 Planned` |
| Reviews/remarks workflow | `📋 Planned` |

### Community and collaboration

| Feature | Status |
|---|---|
| Posts, likes, comments, and image uploads | `✅ Live` |
| Discussions, comments, voting, and resolution | `✅ Live` |
| Communities and membership | `✅ Live` |
| Groups and group roles | `✅ Live` |
| Chat and typing events | `✅ Live` |
| Notifications | `✅ Live` |
| Real-time call signaling | `✅ Live` in Socket.IO code |

### Administration and operations

| Feature | Status |
|---|---|
| Protected admin creation | `✅ Live` |
| First-admin bootstrap script | `✅ Live` |
| Admin dashboard page | `🚧 In Progress` |
| Dedicated admin management system | `📋 Planned` |
| API dashboard/manual API tester | `⚠️ Legacy (needs cleanup)` |
| Upload backup/import/cleanup scripts | `✅ Live` |

## Out of Scope for This Snapshot

- Treating External users as a new mentorship role.
- Replacing the existing `role` authorization model without a migration decision.
- Claiming production readiness: automated test coverage and deployment evidence are incomplete.

See [features.md](features.md) for implementation-level walkthroughs and [tasks.md](tasks.md) for current work.
