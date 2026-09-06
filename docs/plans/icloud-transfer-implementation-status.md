# iCloud content transfer: implementation status

2026-09-06. This is an incomplete implementation of the requested full sync.
Do not interpret deployment of this code as activation of deck/progress sync.

## Delivered in this increment

- CloudKit account checks use `fetchCurrentUserIdentity`, not `setUpAuth`.
  Only explicit authentication setup mounts Apple's controls. Connection checks
  and bootstrap no longer rebuild those controls on each request.
- Platform-independent immutable asset transport uses 128 KiB byte chunks,
  addressed within the bound library generation. Existing verified chunks are
  reused after interrupted upload; downloaded chunks can resume from durable
  platform staging. Each chunk is hash-checked, and aggregate verification is
  required before content installation. This transport does not publish a deck
  or acknowledge a learning outbox.
- The transport is not connected to live learner storage yet. It is included as
  tested code, not advertised as a working sync button.

## Concrete blockers to full activation

## Local projection and durable staging follow-up (0.5.152)

- Content-only deck/card mapping and per-entity three-way merge are implemented.
  Conflicting edits, deleted content, missing histories and stale generations
  stop application instead of silently choosing an upload timestamp.
- Physical-card progress uses the newest actual review. All immutable review
  events survive; virtual reviews never overwrite a physical card projection.
- `applyCloudDeckProjection` applies the plan through the authoritative local
  repository with an exact transactional replica-watermark precondition.
  The journal, materialized records and durable outbox stay consistent.
  No cloud cursor or publication acknowledgement is claimed by this function.
- Browser IndexedDB and native SQLite staging persist partial downloads across
  adapter recreation. Staging is isolated by account, environment, library and
  generation. Native account binding uses the shared bootstrap policy.
- These are callable adapters, not automatic background synchronization. Native
  CloudKit activation, cloud catalog/revision traversal, publication/outbox
  orchestration, peer fencing and physical cloud deletion remain unfinished.
- The test deployment must keep automatic learner-data transfer disabled.
  Mock/IndexedDB integration tests do not replace native/PWA two-device acceptance.

## Remaining activation work

## Atomic catalog and erasure follow-up

- Added the custom-zone atomic record contract and native/Web adapters.
- Added a paged library catalog and per-deck payload ledger; payload creation
  and indexing commit together, with root/deck change-tag guards.
- Deck deletion and progress reset now have shared bounded physical-erasure
  operations, durable cloud cursors and operation-ID retry protection.
- Existing review publication can use the guarded deck store. The native plugin
  remains feature-gated; no existing user zone is created or removed automatically.
- These services still require application orchestration, durable local deletion
  commands, peer fencing and real-device acceptance before the UI may enable sync.

## Application integration still required

The existing `LocalAuthorityRepository` applies mutable CARD/DECK payloads using
`latestMutableMutation`, based on the mutation timestamp. A CARD contains both
content and scheduler state. Merely sending the journal through CloudKit would
let a content edit or old progress payload overwrite newer learning progress.
It would also reuse existing local delete/reset semantics as cloud deletions.
That is incompatible with the requested separate content/progress policies and
local-removal retention. Do not enable that shortcut.

Required next implementation remains:

1. Deck manifest/catalog with immutable revisions and explicit concurrent content
   conflicts; verified platform staging and atomic installation.
2. Durable outbox integration with separate per-card review projection, using
   actual review timestamps and stable review IDs, including virtual cards.
3. Local download removal distinct from cloud-wide deletion/reset, plus physical
   cloud erasure and stale-device protection.
4. Native SQLite account binding, activated CloudKit bridge and the same runtime
   orchestration on iPhone. Entitlement/sign-in alone is insufficient.
5. User-visible offline/restart/two-device acceptance and legacy peer fencing.

Reference for non-rendering account checks:
https://developer.apple.com/documentation/cloudkitjs/cloudkit.container/fetchcurrentuseridentity
