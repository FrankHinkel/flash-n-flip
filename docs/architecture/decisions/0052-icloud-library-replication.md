# ADR 0052: Private iCloud library replication for Apple and PWA

Status: accepted target, 2026-09-06; runtime activation pending implementation
and acceptance. This ADR does not claim that iCloud synchronization is enabled.

## Decision

The user requests private iCloud storage of decks, cards, media and learning
progress with Apple-app and PWA access. SQLite/IndexedDB remain authoritative
for local operation. Once migrated, iCloud is the durable common replica for
that linked library. Peer WebRTC must not run a competing merge/deletion policy
for the same library. Unlinked libraries retain the existing behavior.

This explicitly supersedes the backup-only CloudKit restriction for libraries
that complete the migration in `docs/plans/icloud-library-sync.md`. Existing
backups, local stores and peer replication are not removed by the foundation
implementation. No private data is sent to the VPS.

## Contracts

- Stable library, deck and progress generations scope every review. Deletion
  invalidates the namespace before reclamation. Download removal changes no
  cloud generation and never resets progress.
- Review events retain their IDs and original scheduler before/after states.
  Current progress is the after-state of the newest `reviewedAt` per card,
  with a locale-independent event-ID tie break. Upload time is irrelevant.
- Review union preserves superseded events. An identity reused with different
  content is an integrity error. Future-clock conflicts suspend projection
  rather than silently discarding events or altering their timestamps.
- Content is represented by immutable revisions and verified chunk manifests.
  Concurrent edits remain multiple heads; merging them requires an explicit
  revision referencing the parents. Content timestamps cannot reset progress.
- Conditional writes use CloudKit record change tags. Immutable event creation
  is create-only. Acknowledging a local outbox entry is permitted only after
  publication and a final generation check. Restart retries the same event.
- Account changes invalidate the transport session. Missing linked-library
  control records are not interpreted as permission to upload a fresh copy.

## Activation gates and remaining implementation

The initial contracts and publication algorithm are transport-independent.
Web CloudKit-JS and native CloudKit record adapters implement their conditional
record store. Native registration is guarded by `FNFCloudLibraryEnabled`, which
is not set in the application. Neither adapter is wired into the live repository.
The runtime feature gate
must remain closed until all of the following are implemented and verified:

- An app-specific CloudKit container, native entitlements, origin-restricted
  web API token, schema/indexes and matching Apple/PWA environments.
- A real native/PWA authentication and private record write/read test.
- Durable local account binding, migration checkpoint and outbox integration.
- Full deck/card package mapping, chunk transfer, cloud-only listing and
  download/eviction UI with preservation of unuploaded originals.
- Confirmed deletion/reset, physical removal of obsolete cloud review/content
  payloads and account-switch-safe reclamation. Generation invalidation alone
  is not data erasure; concurrent stale uploads must also be reclaimed.
- A single runtime merge path, old-peer migration fencing and real multi-device
  acceptance, including virtual cards and restart/recovery scenarios.
- Updated privacy/UI texts that match the activated data flow. Private
  CloudKit is not advertised as application-level end-to-end encryption.

Only the foundation is currently implemented. No production schema, iCloud
data, signing configuration or existing user library is changed by this ADR.
