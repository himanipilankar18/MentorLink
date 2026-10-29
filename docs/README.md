# MentorConnect Documentation

Purpose: Index of the current MentorConnect product, architecture, operating rules, design language, features, tasks, and decision history.

Last updated: 2026-10-11

MentorConnect is an active-development mentorship and academic interaction platform. The codebase contains a live static application under `public/`, an Express/MongoDB backend, and a small separate Vite/React landing application. Read [architecture.md](architecture.md) before changing cross-cutting behavior.

| Document | Use it for |
|---|---|
| [MENTORLINK_FINAL_DOCUMENTATION.md](MENTORLINK_FINAL_DOCUMENTATION.md) | Consolidated source of truth for the complete current implementation |
| [PRD.md](PRD.md) | Product problem, audience, scope, and feature status |
| [architecture.md](architecture.md) | Runtime structure, flows, integrations, and legacy boundaries |
| [rules.md](rules.md) | Engineering and agent guardrails |
| [design.md](design.md) | Existing visual language and proposed design-system guidance |
| [features.md](features.md) | End-to-end user and technical walkthroughs |
| [tasks.md](tasks.md) | Living phased work tracker and current focus |
| [memory.md](memory.md) | Dated decisions, completed work, and unresolved questions |
| [API_DOCUMENTATION.md](API_DOCUMENTATION.md) | REST API endpoint reference |
| [EMAIL_SETUP.md](EMAIL_SETUP.md) | SMTP configuration for the active OTP email flow |

Status labels used throughout these documents:

- `✅ Live` - evidenced by active routes, models, and/or UI calls.
- `🚧 In Progress` - partially implemented or actively converging.
- `📋 Planned` - identified scope without a complete current implementation.
- `⚠️ Legacy (needs cleanup)` - still present or reachable, but inconsistent with the active path.
