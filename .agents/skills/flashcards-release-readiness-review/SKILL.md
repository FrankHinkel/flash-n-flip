---
name: flashcards-release-readiness-review
description: Determine whether FlashCards is ready for a beta or public release. Use for release candidates, store builds, production deployment, schema rollout, legal-text changes, infrastructure changes, or any request to declare V1.0 complete.
---

# FlashCards Release Readiness Review

1. Read `references/release-gates.md`.
2. Inspect the exact commit, build configuration, migrations, infrastructure, and legal surface intended for release.
3. Run `scripts/check-release-readiness.sh`.
4. Execute focused Web, API, scheduler, sync, and mobile checks.
5. Verify backup restore, rollback, monitoring, support, and moderation ownership.
6. Report each gate as `erfüllt`, `offen`, `Release-Blocker`, or `extern blockiert`.

## Mandatory blockers

- Any path that publishes without admin approval.
- Known review loss, duplication, or nondeterministic scheduling.
- Placeholder operator, hosting, contact, retention, or store declarations.
- Missing account deletion or export.
- Critical authorization, content injection, or private-media exposure.
- Missing migration rehearsal, backup restore, or rollback.
- Core path unusable with supported accessibility technology.
