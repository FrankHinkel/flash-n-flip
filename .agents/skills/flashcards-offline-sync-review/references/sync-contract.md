# Synchronization contract

- Clients create UUIDv7 mutation and entity IDs.
- Mutations enter a durable outbox before optimistic UI confirmation.
- Server ingestion uses `(user_id, mutation_id)` as an idempotency key.
- Server returns a monotonic user-scoped cursor.
- Clients apply changes transactionally, then advance the cursor.
- Review events are append-only; content edits use explicit versions.
- Deletes use tombstones until every supported client can observe them.
- Media uploads use content hashes and resumable status.
- Conflicts: review events merge; private content uses version checks; public revisions never mutate; moderation is server-authoritative.
