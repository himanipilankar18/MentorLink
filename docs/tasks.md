# Project Task Tracker

Purpose: Maintain the current phased work list and provide one place to see what is active, complete, or unresolved.

Last updated: 2026-09-23

## Current Focus

**External profile enrichment and auth consolidation.** External users now receive a skippable post-OTP profile enrichment step, while Institute Members continue directly to the home page. Legacy Profile Setup, standalone OTP, token verification, and API-dashboard paths remain separate.

See [architecture.md](architecture.md) for the current flow and [rules.md](rules.md) for change guardrails.

## Phase 0: Audit and Baseline

- [x] Inventory active Express route mounts.
- [x] Inventory User schema and authentication fields.
- [x] Trace active registration, OTP, login, and redirects.
- [x] Identify legacy Profile Setup and standalone OTP paths.
- [x] Record current risks in [memory.md](memory.md).
- [ ] Reconcile older project reports with route/model evidence.

## Phase 1: Authentication Consolidation

- [x] Support External and Institute Member identity selection in active registration.
- [x] Support Current Student and Alumni identity selection.
- [x] Keep SPIT email restriction conditional to Current Student registration.
- [x] Mark active OTP-created users verified and profile-complete.
- [x] Redirect active registration to the normal authenticated home page.
- [x] Add a separate skippable External-only profile enrichment step after OTP.
- [x] Add protected External profile enrichment endpoint without changing `profileComplete` semantics.
- [x] Keep the enrichment entry point reachable from `profile.html`.
- [ ] Decide whether `profileComplete` should remain a login gate or be split into separate account/profile concepts.
- [ ] Decide how to retire or formally support `verify-otp.html` and legacy resend behavior.
- [ ] Decide whether `/api/auth/verify-email` remains supported.
- [ ] Replace or redesign the volatile in-memory pending registration store.
- [ ] Remove incompatible registration assumptions from `api-dashboard.html` or label it explicitly as legacy.

## Phase 2: Profile Unification

- [x] Define the relationship between registration data and editable profile data: registration establishes account usability; enrichment adds optional profile context.
- [ ] Decide whether External admission information needs a dedicated private profile view.
- [ ] Ensure private admission information is never included in public profile payloads.
- [ ] Decide whether `profile-setup.html` remains an optional profile editor or is retired.
- [ ] Align profile completion reporting with the active registration meaning of `profileComplete`.

## Phase 3: Recommendations and Matching

- [x] Maintain mentor recommendation endpoint and scoring engine.
- [x] Maintain peer matcher implementation.
- [ ] Define recommendation behavior for External users without academic year or department.
- [ ] Clarify whether `role` or `userType` is authoritative for future mentor eligibility.
- [ ] Add documented evaluation coverage for recommendation ranking and missing fields.

## Phase 4: Collaboration and Community

- [x] Posts and comments.
- [x] Discussions and voting/resolution.
- [x] Communities and membership.
- [x] Groups and group roles.
- [x] Chat REST and Socket.IO behavior.
- [x] Notifications.
- [ ] Consolidate public feature documentation with the actual UI entry points.

## Phase 5: Administration and Operations

- [x] Protected admin creation route.
- [x] First-admin bootstrap script.
- [x] Upload backup/import/cleanup utilities.
- [ ] Define the complete admin management surface.
- [ ] Add a supported automated test strategy; the root `npm test` script currently exits intentionally.
- [ ] Document deployment and environment requirements from `.env.example` and operational scripts.

## Status Rules

- Update this file whenever a task status changes.
- Record the reason for meaningful status changes in [memory.md](memory.md).
- Do not mark a task complete from documentation claims alone; verify the route, model, and UI evidence.
