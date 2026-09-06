# Entry page and iCloud delivery sequence

User decision, 2026-09-06:

- `https://flash-n-flip.com/` will become an informational entry page, not the
  learning application. It should contain product information, an iOS App Store
  link, a later Google Play link, and a clear link to `/app`.
- `/app` is the actual learning application, usable directly in a browser and
  installable as a separate PWA. Installation is optional, not an access gate.
- Before implementing that separation, align manifest identity, start URL, scope,
  service-worker scope and offline navigation with `/app`. The entry page must
  not be captured by an old application-shell fallback. Do not publish invented
  App Store or Play Store links before real listings exist.
- No official learner-data release exists. Migration of historical test data is
  not required. This is not a blanket instruction to delete content or backups.
- The user confirmed CloudKit sign-in works. Chrome needed Shift-Cmd-R to leave
  old artifacts; this is consistent with the observed old 0.5.143 webstack, not
  proof that future update handling is complete.

## Current delivery: private library bootstrap

After explicit authentication, an additional action connects the library. A
pending account binding is committed to IndexedDB before contacting CloudKit.
The private `FlashNFlipLibraryV1` record `library.root.v1` contains only protocol,
library identity/generation and deletion state. Its creation is conditional;
concurrent devices adopt the same winning root. Existing confirmed bindings
refuse account changes, missing roots, deleted roots or changed generations.
Interrupted first connection can resume with the persisted pending binding.

This is not deck synchronization. No learner repository, review outbox, media,
reset or peer-replication path is changed. Logout retains the binding and data.
Development and production bindings are distinct. A successful bootstrap does
not prove offline/multi-device content transfer or native integration.

## Subsequent steps, in order

1. Add the equivalent durable SQLite binding to the native CloudKit adapter and
   verify the same library identity from PWA and iPhone with the same Apple ID.
2. Connect deck manifests and immutable revisions to the local durable outbox;
   implement cloud deck listing and resumable, hash-verified content/media transfer.
3. Connect immutable reviews and per-card latest-review projection using the
   original review time, deterministic ties and clock-error handling. Preserve
   local progress on logout or local download removal.
4. Add explicit cloud-wide deletion/reset and physical payload reclamation,
   then fence the old peer replication path before activating content sync.
5. Exercise offline reviews, duplicates, crashes, two devices, account switching,
   removals and reopen/restart through the actual UI. Do not claim complete sync
   from mock tests or successful authentication alone.

The root landing page is recorded product direction, not part of this bootstrap
deployment. Test deployments retain technical checks and rollback foundations;
the authorized release/legal exception is not a public release approval.
