# Release runbook

1. Freeze the reviewed commit and database schema.
2. Run `pnpm check` and `pnpm release:check`.
3. Rehearse migrations on a recent production-shaped backup.
4. Build Web, API, Android App Bundle, and iOS archive from the same commit.
5. Verify legal, store, monitoring, support, and moderation ownership.
6. Roll out internally, then to 5%, 25%, and 100%.
7. Stop or roll back on data loss, duplicate reviews, authorization bypass,
   publishing bypass, or critical crash regression.
