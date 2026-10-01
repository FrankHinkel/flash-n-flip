# Apple release acceptance matrix

Reviewed 2026-10-02. Source/unit tests and a simulator build are supporting
evidence; each physical-device result needs device/OS/build, steps, outcome and
artifact. The review report records executed checks separately from open gates.

Automated regression coverage now includes mounted settings/language controls,
account-discovery versus explicit iCloud activation, malformed persisted cloud
policy, interrupted full-backup staging, and file-backed real SQLite transactions
including rollback and a lost bridge reply after COMMIT. `pnpm backup:stress`
exports and restores a synthetic backup larger than 256 MiB in separate Node
processes and verifies original-media hashes. These checks supplement the
physical-device scenarios below; they do not establish native memory limits,
share-sheet behavior or remote CloudKit convergence. Detailed evidence:
`docs/quality/reviews/2026-10-02/quality-improvements.md`.

## Release target

- Bundled Capacitor application on a small supported iPhone, current standard
  iPhone, iPad and compatible Apple-silicon Mac.
- Minimum supported and current OS; bright/dark, enlarged text, VoiceOver,
  keyboard navigation, portrait/landscape and safe areas.
- Web viewport checks at 360/390 px, 768 px and desktop support layout review,
  but do not substitute for the real WKWebView.

## Critical flows

1. Cold start in airplane mode without Web server; create/edit/delete a deck
   and text, map, formula, image and audio cards.
2. Study all ratings using the real scheduler previews. Force-quit/reopen and
   confirm exactly one review, correct due date and durable SQLite state.
3. Import CSV/APKG/FNF, malformed and oversized archives, cancellation and
   interruption during staging. Reopen without partial visible installation.
4. Take a photo and record audio; deny/revoke permissions and close the editor
   while permission is pending. Verify original media retention and playback.
5. Export FNF and full JSON backup through the native share sheet; cancel,
   restore on a fresh second device, and compare cards, media, progress/settings.
6. Verify curated hashes/signatures and reject tampering, unknown signer and
   incomplete installation; verify overlapping key rotation.
7. For the approved synchronization architecture: duplicate delivery, interrupted
   transfers, conflicting edits/reviews, tombstones, device revocation and restart
   on two physical devices. The iCloud target is confirmed in ADR 0054; production transport
   activation requires physical two-device acceptance. Debug builds allow that
   acceptance without activating uploads merely through account discovery.
8. Check readable contrast, touch targets, focus, dialogs and no accidental
   overlap/page scrolling in study at small height, zoom and enlarged text.
9. Signed archive/TestFlight, actual privacy report/labels, support and legal
   operator fields, age rating, store screenshots and release gates.

## Parked product paths

Legacy account login, community moderation/publishing/subscriptions, Android,
Web/PWA and peer-delivered updates are outside the current Apple-only acceptance
target. Their retained source and tests remain migration evidence; passing them
does not validate an Apple release or authorize removing their replacements.
