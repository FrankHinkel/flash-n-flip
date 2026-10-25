# Native cloud engine — 2026-10-25

This is implementation/acceptance evidence, not a production-release declaration.

## Automated checks

- Sync package: 99 tests passed.
- Native/web storage adapter package: 221 tests passed, including offline review,
  lost enqueue receipt, duplicate delivery, restart, simultaneous ratings,
  unchanged card hashes after reviews, recursive subdeck hashes, explicit progress
  reset, local eviction/restore, stale-client deletion and complete test reset.
- Apple shell: 35 tests passed.
- Focused Web/native UI suite: 30 tests passed, covering explicit opt-in, paused replication, progress
  before content, collapsible hierarchy, both deletion choices and dialog Escape.
- Sync/storage and Web typechecks passed. Signed Debug iPhoneOS build passed for
  My Mac (Designed for iPad). The same signed app was installed on physical iPhone
  15 and iPad Air 11-inch M2 (iOS/iPadOS 27.0.1).
- Required sync/learning integrity scripts passed. Readability scan: zero static
  failures. Existing unrelated review findings remain outside this change.

## Real CloudKit and user-visible evidence

- A fresh small deck and the 20-card Statistics collection uploaded from the Mac
  through CKSyncEngine; the native content outbox reached zero.
- A Statistics review was recorded through the actual learning screen; the next
  card appeared and progress delivery completed.
- The owner confirmed both decks appeared on the physical iPhone. The same test
  exposed an incomplete reset: the prototype native journal had survived the old
  reset and could republish old content. This was a failed acceptance result,
  not successful clean-library acceptance.
- The corrected reset stops the engine and pending work, fences enqueue and
  projection durably, deletes legacy plus FNF4 test zones, clears the native
  journal and local SQLite tables, and removes staged asset files. A native
  SQLite query-argument error found during the real reset was corrected and
  covered by a strict adapter boundary test.
- The corrected complete reset succeeded on the Mac. Afterwards a fresh explicit
  iCloud sync returned no decks; the actual local library showed **0 cards / 0
  reviewed** and “Noch nichts hier.” All three native queue counts were zero.
- The owner confirmed the final iPhone library and cloud inventory stay empty
  after activation.
- Both physical test installations were uninstalled to remove their previous
  authoritative stores, native journals and cached assets, then freshly installed.
  This intentionally destroys disposable preproduction test data. No migration.
- Device Hub keyboard capture caused global keyboard interference during the
  manual test. Capture was explicitly switched to **off**, and the physical
  iPhone screen window was closed. Further device acceptance uses no keyboard
  capture.

## Expected cancellation handling

The final empty-library check exposed an internal “Task was cancelled” message.
Swift `CancellationError`, CloudKit `operationCancelled` and URL cancellation
now keep the durable queue without becoming a user-visible sync failure. Genuine
network, quota, SQLite and timeout errors remain distinguishable. The compiled
native check (`sh apps/apple/scripts/check-native-sync-cancellation.sh`) passed
three cancellation cases and four genuine-error cases. A focused UI test covers
the bridge cancellation code as well.

The cancellation correction is now installed on Mac, iPad and iPhone. The
iPhone installation succeeded wirelessly after the owner unlocked it. The
subsequent automatic launch was denied because it had locked again (CoreDevice
10002 / FBSOpenApplicationError 7); the owner can open FNF normally. Its
empty-library reset was already confirmed. No device screen sharing was used.

## Still open

- Repeat the final fresh-library import/review/media flow on physical iPhone and
  iPad after the complete reset, without Device Hub keyboard capture.
- Real-device acceptance for interrupted large CKAsset transfers, offline review
  followed by process termination, both deletion scopes with another stale device,
  and maximum accessibility text in the new cloud-management dialog.
- The hierarchy/dialog interactions have automated DOM coverage. Full rendered
  geometry/contrast measurements at 390 px, 200% zoom and largest native text are
  not yet complete; do not mark those UI checks as passed.
- The parked Web V3 adapter does not share the new native V4 library. A Web V4
  adapter is required before claiming Web/Apple cloud interoperability.
- Production CloudKit schema/release enablement remains gated by
  `FNFCloudLibraryEnabled = false`; no production deployment was performed.
