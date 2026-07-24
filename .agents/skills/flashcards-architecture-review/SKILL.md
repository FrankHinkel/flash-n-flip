---
name: flashcards-architecture-review
description: Review FlashCards architecture and package boundaries. Use for changes to the monorepo layout, Expo or Next.js app boundaries, APIs, shared packages, data access, authentication ownership, dependency direction, or architectural decision records.
---

# FlashCards Architecture Review

1. Read `references/architecture-boundaries.md`.
2. Trace the complete path from UI through shared domain logic and API to persistence.
3. Reject duplicated business rules between Mobile, Web, Admin, and API.
4. Require server-side authorization for every protected operation.
5. Keep platform dependencies out of shared domain packages.
6. Record consequential choices under `docs/architecture/decisions`.
7. Report findings as `erfüllt`, `offen`, or `Release-Blocker`, with file evidence.

## Mandatory guardrails

- Keep community content, personal study state, and moderation as separate domains.
- Share contracts and rules, not entire platform-specific interfaces.
- Route database access through the API persistence layer.
- Keep dependency direction from apps toward packages; packages must not import apps.
- Require one canonical validation schema for every API payload.
- Reject hidden runtime coupling through environment variables or global state.
