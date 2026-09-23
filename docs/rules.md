# Engineering and Agent Rules

Purpose: Define the checks and guardrails contributors and coding agents must follow before changing MentorConnect.

Last updated: 2026-09-23

## Before Editing

- Read the owning route, model, UI caller, and relevant middleware before changing behavior.
- Verify active behavior in code; do not treat older reports as authoritative.
- Identify whether the path is active, legacy, diagnostic, or ambiguous.
- Check current working-tree changes before editing and preserve unrelated user work.
- Do not start a parallel auth system when an existing route already owns the behavior.

## Authentication and Identity

- Never assume `profileComplete` has one meaning. It gates login, controls password requiredness, and also represents old Profile Setup completion.
- Do not change `userType`, `instituteRole`, or legacy `role` semantics without tracing login, middleware, recommendations, profile responses, and existing records.
- Do not touch `pendingRegistrations` without explicitly flagging its volatility, single-process scope, and plaintext pre-hash password storage.
- Do not globally apply SPIT email validation. Current Student validation is conditional; External and Alumni behavior must be checked separately.
- Preserve bcrypt hashing through the Mongoose save lifecycle. Be careful with update methods that do not run save middleware.
- Treat JWT contents, expiry, browser storage, and `Authorization` headers as a contract across pages and APIs.

## Legacy Boundaries

- Do not silently merge `profile-setup.html`, `/complete-profile`, `verify-otp.html`, `/verify-email`, or `api-dashboard.html` into the active registration flow.
- Before removing a legacy path, search all references and document the decision in [memory.md](memory.md).
- If active and legacy flows disagree, describe the divergence rather than smoothing it over in documentation or code.

## Schema and API Changes

- No schema change without reviewing existing MongoDB documents and updating [architecture.md](architecture.md) and [memory.md](memory.md) in the same pull request.
- Do not migrate or mutate existing records automatically unless the task explicitly authorizes it.
- Preserve sensitive-field protections such as `select: false` for passwords and private admission information.
- Update API documentation and relevant feature walkthroughs when request or response contracts change.
- Keep optional admission fields optional; do not make External users satisfy institute-only academic requirements.

## Code Conventions

- Match the surrounding JavaScript style and keep changes local.
- Prefer existing route helpers, middleware, models, and utility functions.
- Avoid unrelated formatting or broad refactors.
- Keep user-facing copy clear about whether a flow is active or legacy.
- Do not add dependencies for behavior already supported by the current stack.

## Validation and Review

- Use the narrowest relevant static or executable check after an edit when the task permits it.
- Do not claim a feature is tested when only source inspection was performed.
- Review authorization separately from authentication: `role` checks, ownership checks, and JWT verification are different controls.
- Treat external-user recommendation behavior as a compatibility question because many matching paths depend on `year`, `department`, skills, interests, or mentorship fields.

## Decisions and Commits

- Record architectural decisions, unresolved ambiguities, and completed milestones in [memory.md](memory.md).
- Update [tasks.md](tasks.md) whenever task status changes.
- Suggested commit format: `<area>: <imperative summary>`, for example `auth: clarify active OTP registration flow`.
- Keep commits focused; do not combine auth consolidation with unrelated UI or feature refactors.
