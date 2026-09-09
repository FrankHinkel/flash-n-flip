# ADR 0052: Private iCloud library replication for Apple and PWA

Status: accepted target, 2026-09-06. Phase 1 inventory activated 2026-09-09;
manual replication enters test acceptance in release 0.5.171. Production
activation remains blocked by real multi-device acceptance.

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

## Phase 2 manual replication boundary

Release 0.5.171 introduces a fresh `library.root.v3` namespace. Earlier test
generations remain ignored and cannot be mistaken for the active library. The
new path is deliberately manual:

- opening My iCloud performs only the bounded inventory read;
- synchronization starts only through an explicit Sync, Download, Remove or
  Delete action;
- there are no focus, online, reload, interval or retry-timer triggers;
- every operation exposes finite object/byte progress and a request counter and
  can be stopped;
- remote-only decks remain header-only until the user explicitly downloads
  them.

Personal and imported decks use immutable content revisions and separately
verified media assets. Curated content remains deployment-owned; iCloud stores
only its stable activation and review events. Reviews are published before deck
content. Cards are serialized by due date, content precedes media, and media is
last. A revision is installed only after all referenced assets verify, so an
interrupted priority transfer never exposes a partial deck as complete.

Local removal retains the cloud generation and learning progress. A full delete
advances deck and progress generations, publishes a tombstone and then reclaims
old records in bounded pages. Interrupted reclamation is resumed by another
explicit action and stale devices cannot resurrect the invalidated generation.

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

## Remaining activation gate

- Complete the real Web/PWA and Apple two-device acceptance, including import,
  review conflict, restart, local removal, download and cloud deletion, before
  version 0.6.0.
