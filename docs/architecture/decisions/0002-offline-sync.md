# ADR 0002: Append-only reviews and idempotent synchronization

Status: accepted

Clients persist mutations before optimistic confirmation. Every mutation has a
client-generated UUIDv7. The API stores `(user_id, mutation_id)` uniquely and
returns a monotonic user cursor. Review events are immutable and merge across
devices. Editable private content uses explicit versions.

Mobile uses SQLite, Web uses IndexedDB, both behind the same repository
contracts. Derived scheduler state can be rebuilt from ordered review events.
