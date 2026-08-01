# Flash-n-Flip local-first Web and Apple migration

This repository is the new Apple-first, local-first generation of Flash-n-Flip.
The legacy checkout at `/Users/frank/Documents/FlashCards` is a read-only
migration source. Never modify, clean, reset, commit, or push that checkout from
work performed in this repository.

## Product scope

- Keep the existing React/Next.js Web application and its VPS deployment as the
  product's visual and functional reference.
- Deliver that Web design through Capacitor on iOS and iPadOS.
- Support Apple-silicon Macs initially through the compatible iOS/iPadOS app.
- Keep learner-owned decks, media, settings, and study progress local-first.
- Use IndexedDB in the browser and SQLite in installed applications as the
  authoritative local stores.
- Use the authenticated VPS API as the cross-platform synchronization and
  backup transport. Every client must remain usable while the VPS is
  temporarily unavailable.
- Keep the synchronization protocol portable so later Android and Windows
  clients can use the same backend without duplicating domain rules.
- Do not add CloudKit as a second live synchronization authority. A later ADR
  may define it as an optional Apple-only backup/export target.
- Distribute curated collections, decks, and references as signed, versioned,
  static downloads.
- Keep community publishing and moderation outside the first migration phase.

## Architecture boundaries

- Apps depend on shared packages; shared packages must never import apps.
- Keep domain, scheduler, package-format, and synchronization rules independent
  from Capacitor, PostgreSQL, SQLite, Next.js, and browser APIs.
- Put platform adapters in the owning app or in explicitly platform-specific
  packages.
- Do not duplicate scheduling, validation, language, or deck-format rules
  between Web and Apple targets.
- Personal study state, curated catalog content, and any future community
  publishing are separate domains.

## Data-integrity rules

- Persist mutations in a durable local outbox before confirming them in the UI.
- Give every review and mutation a stable client-generated identifier.
- Keep review events append-only and make synchronization idempotent.
- Advance server cursors only in the same local transaction that durably stores
  and applies all preceding changes.
- Resolve conflicts per entity; never use blanket last-write-wins.
- Use tombstones for synchronized deletions and keep media transfer resumable
  and separate from metadata synchronization.
- Never silently discard local data when the VPS is unavailable, an account is
  signed out, synchronization is interrupted, or a device restarts.

## Migration workflow

- Migrate one user-visible flow at a time and compare it with the legacy Web
  implementation.
- Preserve the Web visual behavior unless a documented platform constraint
  requires a change.
- Add tests before removing the corresponding legacy API dependency.
- Record consequential architecture changes under
  `docs/architecture/decisions`.
- Do not remove the legacy Expo, API, or deployment code from this repository
  until its replacement flow has passed the migration acceptance checks.

## Verification

- Run focused tests for every changed package.
- For study or synchronization changes, test offline use, duplicate delivery,
  interrupted synchronization, multi-device conflicts, and process restart.
- For UI migrations, verify the real flow on an iPhone-sized viewport and in an
  iOS WebView before declaring parity.
- Treat silent review loss, duplicated reviews, corrupt deck installation, and
  unrecoverable migration failures as release blockers.
