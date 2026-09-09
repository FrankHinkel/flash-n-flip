# ADR 0052: Private iCloud library replication for Apple and PWA

Status: accepted target, 2026-09-06. Phase 1 inventory activated 2026-09-09;
replication remains pending implementation and multi-device acceptance.

## Decision

The target is private iCloud storage of personal decks, media and learning
progress for Apple apps and the PWA. SQLite and IndexedDB remain authoritative
for offline operation. No private content is stored on the Flash-n-Flip VPS.
A linked library must eventually use one merge and deletion policy; CloudKit
and peer WebRTC must not act as competing authorities.

## Phase 1 inventory boundary

Release 0.5.170 activates only a read-only inventory:

- the PWA uses persistent CloudKit JS Apple authentication;
- Apple apps use the system iCloud account;
- deterministic batch reads cover only the library root, catalog, ledgers,
  ledger pages and revision or activation headers;
- one pass uses at most 12 CloudKit data requests, with at most 200 record
  names per request;
- the inventory reads no card packages, media, reviews or progress payloads;
- no CloudKit create, update, delete, query, retry or polling path is active.

The UI merges inventory entries by stable deck ID and keeps the local deck
record authoritative for title, hierarchy and card count when it exists.
Cloud-only entries use the available immutable revision header. Missing or
invalid records produce an incomplete/error state and never discard local data.

## Replication contracts

- Stable library, deck and progress generations scope every review. Deletion
  invalidates the namespace before reclamation.
- Review events retain stable IDs and original scheduler states. Current
  progress is the after-state of the newest actual review time per card, with
  an event-ID tie break; upload time is irrelevant.
- Content uses immutable revisions and verified chunk manifests. Concurrent
  edits remain separate heads until explicitly merged.
- Outbox acknowledgement is permitted only after durable publication and a
  final generation check. Restart retries the same event.
- Account changes invalidate the transport session. Missing linked-library
  control records never authorize a fresh upload.

## Remaining activation gates

- Learning-progress replication with duplicate, interruption, clock and restart
  tests.
- Product decision and implementation for personal deck/media replication;
  curated deck content remains deployment-owned.
- Staged header, scheduled-card and remaining-content transfer.
- Local removal, cloud deletion and physical reclamation semantics.
- One active authority path and real two-device acceptance before version 0.6.0.
