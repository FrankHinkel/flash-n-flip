# Architecture boundaries

Allowed dependency direction:

```text
apps/mobile ─┐
apps/web ────┼──> packages/api-client ──> packages/domain
apps/admin ──┘
apps/api ───────> packages/domain
packages/scheduler ──> packages/domain
packages/sync ───────> packages/domain
```

- Apps may depend on packages; packages must not depend on apps.
- Only the API persistence layer accesses PostgreSQL.
- Mobile SQLite and Web IndexedDB implement shared repository contracts.
- Community revisions never contain learner review state.
- Admin is a distinct authorization role even when rendered by the Web app.
