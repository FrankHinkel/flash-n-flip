# ADR 0018: Local-first application with Capacitor and VPS synchronization

- Status: Accepted
- Date: 2026-08-01
- Baseline: legacy commit `4d30f7f6b8ca12a6b457292c612a50b99f71a276`

## Context

Flash-n-Flip currently has a mature React/Next.js learner interface, a Fastify
API, PostgreSQL persistence, and a working VPS deployment. The separate
Expo/React Native learner interface duplicates navigation, study-card layout,
maps, media, and editor behavior. The Web interface is therefore both the
visual reference and an independently useful client.

Personal decks and learning progress are currently server-centric. Installed
applications must become fully usable offline, while Web, iPhone, iPad, and
Apple-silicon Mac users must be able to continue the same learning history.
Later Android and Windows clients must not require a second synchronization
model or an Apple account.

## Decision

1. Keep the existing React/Next.js Web application and VPS deployment.
2. Reuse the learner Web UI in an iOS/iPadOS Capacitor shell instead of
   continuing the separate Expo learner UI.
3. Offer the compatible iOS/iPadOS application on Apple-silicon Macs during the
   first phase. A dedicated macOS target is deferred.
4. Make IndexedDB authoritative for migrated Web flows and on-device SQLite
   authoritative for installed clients. Unmigrated flows may continue using
   the existing API during the transition.
5. Use the authenticated VPS API, PostgreSQL change log, and separate resumable
   media transfer as the cross-platform synchronization and backup transport.
6. Keep local-only operation, explicit export, and explicit import available
   while the VPS is unavailable or synchronization is disabled.
7. Do not run CloudKit and the VPS as competing live synchronization
   authorities. CloudKit may be considered later as an optional Apple-only
   backup or export target.
8. Publish curated collections, decks, and references as immutable, versioned,
   signed packages behind a static catalog. Installation copies content into
   the local database.
9. Defer public user submissions, community moderation, recommendations,
   native Android/Windows packaging, and tvOS presentation to later decisions.

## Dependency direction

```text
apps/web ────────┐
apps/apple ──────┼──> shared UI and application services
future clients ──┘             │
                               ├──> domain and scheduler
                               ├──> repository contracts
                               └──> sync protocol

Web IndexedDB adapter ─┐
Apple SQLite adapter ──┼──> durable outbox and local change application
future adapters ───────┘                    │
                                           └──> authenticated VPS sync API
                                                      │
                                                      ├──> PostgreSQL log
                                                      └──> resumable media

static catalog ──────> immutable signed deck packages
```

Apps depend on shared packages; shared packages never import apps. Next.js,
Capacitor, IndexedDB, SQLite, PostgreSQL, and HTTP stay behind their owning
adapters.

## Synchronization invariants

- Reviews and mutations use stable client-generated UUIDv7 identifiers.
- A mutation enters a durable local outbox before the UI confirms it.
- Review events are append-only and safe to deliver more than once.
- Server ingestion is idempotent per user and mutation identifier.
- A client advances its server cursor only in the same local transaction that
  durably stores and applies all preceding changes.
- Content edits use explicit versions; deletions use tombstones.
- Conflicts are resolved per entity, with no blanket last-write-wins policy.
- Media assets synchronize separately from record metadata and remain
  resumable.
- The backend never silently treats transport receipt as successful domain
  application.

## Consequences

### Positive

- The mature Web application and deployment remain useful throughout the
  migration.
- Web, Apple, and later Android/Windows clients can share one account and one
  synchronization protocol.
- Installed clients continue learning during VPS outages.
- Review and metadata traffic remains small and batchable; large media uses a
  separate transfer path.
- Users do not need an Apple account.

### Costs and risks

- The project remains responsible for account, database, backup, deletion,
  export, security, and retention operations on the VPS.
- Existing API-driven flows must move behind local repository contracts one
  user-visible flow at a time.
- Browser storage can be removed by the browser or user, so unacknowledged
  outbox entries and recovery behavior need explicit tests and warnings.
- Dual live synchronization through VPS and CloudKit is intentionally excluded
  because it would create competing cursors and conflict authorities.

## Release gates

- No silent loss or duplication of review events in offline, restart,
  interrupted-transfer, and multi-device tests.
- A new browser profile or device can reconstruct synchronized personal data
  from the VPS.
- A complete local export is available independently of server backup access.
- Catalog packages are hash-verified and signature-verified before
  installation.
- Login, normal study, map study, KaTeX, media, import, and deck editing match
  the accepted Web behavior on a physical iPhone.
- Privacy information accurately describes local storage, VPS processing,
  hosting, deletion, retention, and export.
