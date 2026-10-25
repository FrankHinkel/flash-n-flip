# 0057 — Native CKSyncEngine library

Status: implemented; acceptance status is recorded in the verification log.

Supersedes the native V3 ledger/chunk transport in ADR 0052. The local authority
and explicit activation requirements of ADR 0054 remain in force. FNF is not in
production. The owner authorized deleting the old test library immediately on
2026-10-25; there is no data migration or compatibility requirement for V3 data.

## Decision

The Apple app requires iOS/iPadOS 17 and uses one CKSyncEngine for its private
CloudKit database. SQLite remains authoritative. The native transport owns a
separate SQLite journal with durable outbox, inbox, CloudKit system fields and
engine serialization. A downloaded batch is durable before its engine token is
persisted. The WebView validates and projects the inbox into local entities;
acknowledgement follows that transaction. Replaying after a process crash is
idempotent. Account discovery does not enable replication. Account changes pause
replication without deleting or exporting local data to another account.

Progress and content occupy separate custom zones (`FNF4Progress` and
`FNF4Content`). Every review is an immutable, independently identified record.
Progress is fetched first and sent before bounded content batches (20 records).
A local review also explicitly wakes the progress lane. CKSyncEngine handles
change tokens, notifications, batching and metadata retries. This does not imply
a guaranteed background delivery deadline imposed on iOS.

Cards carry canonical SHA-256 content hashes excluding scheduler state,
introduction time and review-related update timestamps. Each deck/subdeck has an
own metadata hash and a recursive hash over its ordered child IDs/hashes and
card/media IDs/hashes. Record identity is independent of hashes. Only a changed
hash enters the native content outbox. Reviews never resend the deck body.

The portable projection chooses the latest actual review time per card. Equal
times choose the worse rating, then the stable review ID. It projects the saved
FSRS result without recomputing a different scheduling formula. Concurrent
content edits use an entity-specific revision clock and stable mutation ID.
A tombstone permanently dominates updates to the same identity; reimporting
deleted content must allocate fresh identities.

Media uses immutable, SHA-256-addressed CKAsset records in `FNF4Assets`, separate
from the metadata engine's fetch scope and send queue. Transfers are persisted
as independent jobs. Partial local files never become installed media.

"Only on this device" durably suppresses the subtree before local eviction. It
retains cloud content and reviews; restoring clears suppression and projects the
cached records. "Everywhere" enqueues a subtree tombstone in the durable native
outbox and removes its local projection. Offline replicas cannot revive a deleted
identity when they reconnect.

The native build never starts the V3 JavaScript ledger runtime. Existing V3 and
peer sources remain parked for reference and their regression tests. Browser
CloudKit JS is still a separate, old-format adapter and does **not** interoperate
with this new Apple library; a portable V4 Web adapter is follow-up work before
claiming Web/Apple cloud parity. The VPS stores no private library data.

## Reset and verification

A DEBUG-only reset deletes the old `fnf.*`/`FlashNFlip*` private zones and V1
records in the default zone plus FNF4 test zones. It stops transport first,
fences enqueue/projection, clears the native journal and local entities/media,
and remains paused after completion. The reset fence persists after interruption;
activation stays blocked until a complete retry. No production reset endpoint
is exposed.

Verification evidence and outstanding device requirements are recorded in
`docs/verification/2026-10-25-cloud-engine/README.md`. Do not infer multi-device
acceptance from build/unit results or successful CloudKit sign-in alone.
