# Apple-first local-first migration

## Source and safety boundary

- Legacy checkout: `/Users/frank/Documents/FlashCards`
- New checkout: `/Users/frank/Documents/flash-n-flip`
- Imported baseline commit: `4d30f7f6b8ca12a6b457292c612a50b99f71a276`
- New development branch: `codex/apple-local-first`
- The legacy checkout remains untouched and deployable.
- The new checkout's `legacy` remote is fetch-only; its push URL is disabled.

## Target milestones

### M0: Independent migration workspace

- [x] Create the separate checkout from a clean legacy commit.
- [x] Prevent pushes from the new checkout into the legacy checkout.
- [x] Record the Apple-first architecture decision.
- [x] Add repository-local migration guardrails.
- [ ] Add the folder to the Codex project catalog.

### M1: Web and VPS local-first synchronization foundation

- [x] Keep the existing React/Next.js learner UI and production VPS deployment.
- [x] Publish accepted review events to the per-user server change log in the
      same transaction as scheduler state.
- [x] Store pulled changes and the server cursor atomically in IndexedDB.
- [x] Verify offline review, restart, duplicate delivery, interrupted pull, and
      two-browser recovery.
- [ ] Extend the local repository and outbox path to decks, cards, settings,
      imports, and media metadata one flow at a time.

Go/no-go: Continue only when a review accepted in one browser is recovered in a
second browser without loss, duplication, or scheduler drift.

### M2: Capacitor Web parity and local application data

- [ ] Produce a static, bundled build of the learner Web UI.
- [ ] Add an iOS/iPadOS Capacitor shell.
- [ ] Define platform-neutral repository contracts.
- [ ] Implement the SQLite schema and migrations.
- [ ] Move deck listing, deck editing, imports, media metadata, and settings to
      local repositories.
- [ ] Move study queue creation and scheduler updates to shared application
      services.
- [ ] Persist review events and mutations in a durable outbox.
- [ ] Add complete local export and import.
- [ ] Verify normal study, map study, KaTeX, audio, TTS, and deck editing on a
      physical iPhone.
- [ ] Verify responsive behavior on an Apple-silicon Mac.

### M3: Cross-platform VPS synchronization

- [ ] Define versions, tombstones, account-scoped cursors, and retention.
- [ ] Implement idempotent push and transactional pull.
- [ ] Define conflicts separately for reviews, deck metadata, cards, settings,
      deletions, and media.
- [ ] Handle no account, sign-out, storage exhaustion, throttling, server
      outage, interruption, and multiple devices.
- [ ] Rebuild a new device from the VPS and verify review history.

### M4: Static curated catalog

- [ ] Define the catalog manifest and immutable package format.
- [ ] Add version, locale, license, source, size, SHA-256, and signature fields.
- [ ] Verify hashes and signatures before installation.
- [ ] Keep downloaded content usable offline.
- [ ] Support update discovery without overwriting personal learning progress.

### M5: Legacy data migration and release

- [ ] Export an existing account from the legacy server.
- [ ] Import decks, media, settings, review history, and scheduler state locally.
- [ ] Verify counts, hashes, relationships, and due dates before acknowledging
      migration success.
- [ ] Keep the legacy source recoverable until the user confirms the migrated
      state on at least two devices.
- [ ] Update legal and privacy surfaces for the actual VPS, browser storage,
      application storage, and static-host data flows.

## User-visible acceptance matrix

| Flow                          | Legacy reference | New implementation                    | Status                |
| ----------------------------- | ---------------- | ------------------------------------- | --------------------- |
| Deck overview and hierarchy   | Web              | Capacitor Web UI plus SQLite          | Pending               |
| Normal study and FSRS ratings | Web/API          | Local application service             | Pending               |
| Map study and gestures        | Web              | Capacitor WebView                     | Pending               |
| KaTeX and references          | Web              | Bundled Web UI                        | Pending               |
| Audio and language-aware TTS  | Web              | Web or native adapter                 | Pending               |
| Deck editor and media         | Web/API          | Local repositories                    | Pending               |
| Anki and package import       | API              | On-device importer or reviewed bridge | Pending               |
| Cross-device progress         | Server sync      | Local stores plus VPS sync            | Review slice verified |
| Curated collections           | Server templates | Static signed catalog                 | Pending               |

## Non-goals for the first release

- Native Android and Windows distribution in the first release.
- Public user uploads and community publishing.
- Moderation, reports, rankings, and recommendations.
- A dedicated native macOS target.
- Removing the legacy production website before migration is proven.
