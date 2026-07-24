---
name: flashcards-offline-sync-review
description: Review FlashCards offline persistence and synchronization. Use for local databases, outboxes, cursors, mutations, conflict handling, media transfer, retries, device changes, clock handling, or any path that can duplicate or lose user data.
---

# FlashCards Offline Sync Review

1. Read `references/sync-contract.md`.
2. Inspect local mutation, outbox, API ingestion, cursor advancement, acknowledgement, and retry paths.
3. Run `scripts/check-sync-integrity.sh`.
4. Exercise offline, duplicate-delivery, interrupted-upload, timezone, and multi-device cases.
5. Mark any silent data loss or duplicated review as `Release-Blocker`.

## Mandatory guardrails

- Give every mutation and review event a stable client-generated ID.
- Make server ingestion idempotent.
- Advance cursors only after durable application of all preceding changes.
- Define conflict resolution per entity; do not apply blanket last-write-wins.
- Keep media transfer resumable and separate from metadata synchronization.
- Preserve unsent outbox entries across process termination.
- Make destructive remote changes explicit and recoverable where practical.
