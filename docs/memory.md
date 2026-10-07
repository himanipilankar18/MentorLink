# Project Memory

Purpose: Preserve dated decisions, completed work, and unresolved questions for contributors and coding agents.

Last updated: 2026-09-23

This file is an append-only decision journal. Add new entries rather than rewriting historical context.

## 2026-09-23 — External profile enrichment step

- Added `complete-external-profile.html` for External users only after successful OTP verification.
- Added protected `POST /api/auth/external-profile`, using the existing JWT and Multer upload validation.
- The step collects only profile picture, optional bio, required mentorship intent and availability, optional interests/skills, project link, and GitHub URL.
- The step is intentionally skippable because `profileComplete` already means the account is usable and should not be repurposed as an enrichment gate.
- Institute Member verification still redirects directly to `home.html`.
- No schema change or new enrichment flag was needed; all fields already exist in `User.js`.
- Added an External-only `Enrich Profile` entry point from `profile.html`.
- The old `profile-setup.html`, `verify-otp.html`, and `/api/auth/complete-profile` paths were left unchanged and remain legacy cleanup candidates.

## 2026-09-23 — Documentation baseline

- Completed a read-only architecture pass over the current Express routes, Mongoose models, middleware, static pages, React landing app, package metadata, and feature routes.
- Confirmed that `server.js` serves the `public/` static application and does not mount the Vite/React app as the main product UI.
- Confirmed the active registration sequence: `register.html` → `/api/auth/register` → in-memory OTP pending state → `/api/auth/verify-otp` → MongoDB User with `isVerified: true` and `profileComplete: true` → `home.html`.
- Confirmed the active login sequence: `login.html` → `/api/auth/login` → account-type, active, verified, and profile-complete checks → bcrypt comparison → seven-day JWT → `dashboard.html` for admin or `home.html` for other users.
- Confirmed that `profile-setup.html` and `/api/auth/complete-profile` remain reachable legacy paths but are bypassed by active registration.
- Confirmed `verify-otp.html`, `/api/auth/verify-email`, and portions of `api-dashboard.html` represent parallel or stale contracts.

## Decisions and Constraints

- External guidance is an explicit opt-in defaulting to off. Any mentor change locks the choice through the current academic-year end to prevent casual reversal and stranded External contacts.
- The academic-year-end source is the singleton `AcademicYearConfig` document, admin-editable through `/api/users/academic-year-config`, with a June 30 fallback for first initialization.
- An admin early-unlock override was deferred; mentors cannot self-unlock because the server rejects all changes while the lock date is future.
- The consent fields and tag are intentionally not exposed to External-facing routes; the tag is informational for Institute Members only. This is a prerequisite for the External matching/dashboard phase and that phase must not start until this feature is live and verified.

- Treat mounted routes, route handlers, models, and current UI callers as the source of truth when they conflict with older reports.
- Keep `userType`/`instituteRole` identity separate from legacy `User.role` authorization until a deliberate migration decision is made.
- Treat `admissionInfo` as private schema data because it is configured with `select: false`; do not expose it through public profile responses by accident.
- Do not change MongoDB records as part of documentation work.
- Do not silently merge legacy auth flows into the active flow.

## Known Risks

- `pendingRegistrations` is process-local, volatile, and stores plaintext passwords before the Mongoose save hook hashes them.
- The reusable `validateEmailDomain` middleware exists but is not attached to the active registration route; the API dashboard has its own stale SPIT-only check.
- `profileComplete` now means both “active registration has collected required account data” and “legacy profile setup is complete,” which can mislead future changes.
- Existing users may have no `userType`; login treats missing values as `INSTITUTE_MEMBER` for context.
- Recommendation and profile-strength logic depends on academic/profile fields that External users may not have.
- The root `npm test` script is a placeholder that exits with an error; implementation evidence is not automated test evidence.

## Open Questions

- Should pending registrations move to a durable, hashed temporary store or a dedicated collection?
- Should `profileComplete` be replaced or supplemented with separate account-registration and profile-completion states?
- Should the legacy Profile Setup page remain as an optional profile editor, be replaced by `profile.html`, or be retired?
- Should standalone `verify-otp.html` and `/api/auth/resend-otp` be repaired to match the active in-memory flow or removed?
- Should External users participate in recommendations, and which missing academic fields should be optional defaults?
- Which admin capabilities are required beyond protected admin creation and the current dashboard page?
- TODO: Confirm production deployment, email provider, MongoDB topology, and supported environment matrix from maintainers.

## 2026-10-05 - External guidance terms and Phase A

- Added optional `externalGuidanceTermsVersion` and `externalGuidanceTermsAcceptedAt` fields without defaults or migration.
- Added the reviewable draft terms and `MENTOR_GUIDANCE_TERMS_VERSION` in `config/externalGuidanceTerms.js`; institute/legal review is still required.
- Enabling requires the current accepted terms version; disabling does not. Both directions lock until the academic-year end date.
- Consent metadata is self-only for institute mentors. Institute users may see only the informational availability tag; External users see none of the guidance fields.
- Added an admin-only verification summary returning opted-in mentor name, department, and year only.
- Source syntax/load checks passed for the changed backend modules. Seeded test-DB endpoint/UI verification remains outstanding because no runtime test was run in this phase.

## 2026-10-05 - Consent modal refinement

- Refined the mentor ON flow so the switch never changes before a successful PATCH; terms appear only in the opened modal, with the fetched lock date and a reset, checkbox-gated Confirm button.
- Cancel, Escape, outside click, request errors, and network errors preserve the previous switch state. OFF still confirms the lock-on-both-directions decision without terms.
- Restyled the guidance section and modal to match profile.html's existing light theme. Seeded test-DB and browser interaction verification remains outstanding.

## 2026-10-05 - Live profile editor and academic-year date display

- Confirmed the live profile editor is `public/home.html` `#profile`; its guidance control now uses the Phase A modal flow and the general profile save no longer sends guidance state.
- Kept `public/profile.html` as a supported fallback and aligned its consent date formatting with the live editor.
- Chose fixed UTC date-only formatting for academic-year end dates because the stored value is an end-of-day UTC instant; this displays `2027-06-30T23:59:59.999Z` as June 30, 2027 instead of allowing local timezone rollover.

## 2026-10-05 - Live profile guidance badge

- Diagnosed the missing self-profile tag in `home.html#profile`: the header read `availableForExternalGuidance`, but used a strict `userType === 'INSTITUTE_MEMBER'` comparison instead of the page's normalized Institute Member fallback.
- Centralized the badge gate for own and other-user profile views, preserving the informational boolean for Institute viewers while keeping External viewers filtered. Successful toggle saves now update the local user and header immediately; turning off removes the tag.
- The seeded mentor fixture uses legacy `User.role: 'senior'`; live DB/API verification was not run because the configured database was not verified as test-only.

## 2026-10-07 - Phase 2 external dashboard and community visibility

- Removed the placeholder Settings tab from `public/home.html` for all users. It contained no controls; logout remains in the sidebar, password/account editing remains in the existing profile/auth flows, and the backend routes were not deleted. Settings references were the sidebar item, view container, view switch, renderer, and click handler.
- External dashboard navigation hides Feed and Messages (community/group chat access is not yet an approved External surface) and keeps Profile, Communities, Media, Find Mentor, Requests, and Logout.
- External profile/request presentation uses `External` and `Seeking Admission Guidance` badges. External profiles keep skills, interests, projects, and the Communities post scope while hiding the composer and personal My Posts scope.
- Added `Community.allowInternal` (default `true`) and `Community.allowExternal` (default `false`). Missing legacy fields are interpreted using those defaults in `utils/communityAccess.js`; no database migration or writes were performed.
- Community visibility is enforced at request time with 404 responses for disallowed communities. Owners/admins retain management access, memberships are not edited when a flag changes, and External users cannot create or moderate communities.
- External mentor recommendations and requests are limited to active senior/faculty users with a current-year opt-in (`availableForExternalGuidance` and a future `externalGuidanceLockedUntil`). External requests are capped at three pending requests.
- Peer recommendations/connections, calls, and External groups remain deferred because their scope and fraud/access risks require a separate decision.
- The two named existing communities could not be verified against the test database in this session; no names were found in repository fixtures/scripts, so no explicit values were written.
