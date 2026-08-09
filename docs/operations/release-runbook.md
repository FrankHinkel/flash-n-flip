# Release runbook

1. Freeze the reviewed commit, local-data generation and rendezvous protocol.
2. Run `pnpm check` and `pnpm release:check`.
3. Rehearse local database upgrades and restore from a complete local backup.
4. Generate and verify the curated bundle; build Web, rendezvous API and iOS
   archive from the same commit.
5. Verify legal, store, monitoring, support, and moderation ownership.
6. Roll out internally, then to 5%, 25%, and 100%.
7. Stop or roll back on local data loss, duplicate reviews, rendezvous
   capability bypass, accidental private endpoint exposure, or critical crash.
