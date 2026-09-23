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
