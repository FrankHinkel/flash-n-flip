# ADR 0054: One live iCloud authority for explicitly linked libraries

Date: 2026-09-06
Status: Implementation pending verification and two-device acceptance

## Decision

The user's explicit iCloud product direction supersedes the older peer-only
product direction for a library after the user enables iCloud. Browser and iOS
use the same orchestrator and domain policies. IndexedDB/SQLite remain the local
source for offline learning; private payloads go directly to the user's private
CloudKit database, never through the Flash-n-Flip VPS.

A durable local account/environment policy fences inbound peer mutations and
peer transport before any cloud content upload. Pausing/signing out does not
remove the fence or local data. Browser writers and activation/deletion intent
share a Web Lock; SQLite operations retain their native transaction lock.

The default-zone root discovers the shared library. A separate shared pending /
ready marker reserves custom-zone initialization. Once ready, a missing zone is
an error, not permission to recreate deleted data.

## Data flow

- Immutable content revisions contain structured deck/card content, never card
  scheduler state. Media and content travel through verified 128 KiB chunks.
- Media is durably installed and verified before the local entity transaction.
- Local content uses per-entity three-way merge. Conflicts require an explicit
  version choice; publication references all observed parent heads.
- Every local review is uploaded with its stable review ID. The actual review
  timestamp determines each card's state; all review events are preserved until
  an explicit cloud-wide reset/deletion.
- A durable pending publication retains its revision ID and staged bytes across
  restart/lost responses. Acknowledgements cover only the captured transfer
  snapshot, never work created while that transfer was running or unrelated
  settings/study-plan mutations.
- Foreground activation, reconnect and visible periodic refresh resume work.
  There is no requirement for both devices to be simultaneously online, and no
  claim of guaranteed operating-system background execution.

## Deletion and local removal

The UI distinguishes local download removal, cloud-wide deck deletion and
cloud-wide progress reset. Legacy local reset/deck-delete actions are refused
for linked libraries and direct the user to the scoped iCloud controls.

A durable command and write barrier protect explicit deletion. Cloud generation
rotation and bounded physical erasure finish before local progress is erased.
Completed operations must be idempotent locally as well as in CloudKit. A stale
client applies a changed progress generation before uploading old local reviews.
Peer replication remains fenced after journal retirement, so old review payloads
cannot re-enter through a second authority.

Download removal first completes publication. It removes local deck entities but
retains review history and the remote revision for later restoration. Internal
verified staging caches are not represented as a second user library and may
retain transfer bytes; removal is not a secure-device-erasure guarantee.

Parent deck deletion/removal currently requires handling children first. The UI
must not silently cascade across additional decks that were not confirmed.

## Boundaries and acceptance

This iteration syncs decks/cards/media/reviews, not settings or named study
plans. Per-asset transfer is bounded at 128 MiB and content JSON at 32 MiB;
exceeding a bound preserves local work and reports an incomplete sync.

The root landing page / optional `/app` PWA split remains recorded product work,
not part of this synchronization change. A four-marker delivery commits/pushes
but does not deploy the web application to the VPS.

Native Debug builds use the development CloudKit environment; distribution
builds use production. The two-device acceptance must use matching environments
and the same Apple account. Native signing/profile and the production CloudKit
schema remain platform prerequisites.

Do not call this release-ready from mocked CloudKit tests or Swift syntax alone.
Use the actual browser/PWA and signed iOS build for the final acceptance below.
