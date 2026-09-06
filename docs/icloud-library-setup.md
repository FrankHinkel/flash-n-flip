# iCloud library setup and implementation status

Date: 2026-09-06. This is a guarded implementation foundation, not an activated
iCloud library feature. Existing libraries and encrypted backups are untouched.

## Implemented

- Shared, versioned library/deck/progress identities and review contracts.
- Latest-review selection per card with original scheduler after-states,
  deterministic ties, duplicate/collision handling and future-clock conflicts.
- Immutable deck revision ancestry, explicit concurrent heads and validated
  content/media chunk manifests with missing-chunk calculation.
- Conditional review publication: immutable event first, derived progress
  second, generation checks and idempotent recovery after interruption.
- CloudKit JS sign-in preparation and conditional record transport, following
  Pianoforte's private-database approach with a separate Flash-n-Flip container.
- Native CloudKit plugin and bridge implementing the same record-store contract.
  The plugin is compiled into the project but not registered unless the absent
  `FNFCloudLibraryEnabled` build flag is explicitly enabled.

## Required Apple configuration

The source references container `iCloud.com.flash-n-flip` and Apple team
`W3MZ3XV975`. This does not prove that the container is provisioned for that
team. The existing `App.CloudKit.entitlements` is still a dormant template.
No CloudKit key was found in the checked root environment files.

Before the live test, establish:

1. Container ownership and CloudKit capability for the real Flash-n-Flip app ID.
2. The environment used by both clients: development or production.
3. A JavaScript API token for this container/environment, restricted to the
   exact PWA/test origins and configured for Apple's JavaScript sign-in callback.
4. Record type `FlashNFlipLibraryV1` in the private database, with `schemaVersion`
   as an integer and `payload` as a string. Current record adapters only implement
   addressed reads and conditional writes; listing and asset transfer still
   require their subsequent schema and implementation work.
5. Correct native signing/provisioning and entitlements. Do not enable the
   runtime just because the source template exists.

The web preparation function accepts explicit configuration; it does not read
hidden environment variables. Its caller must mount Apple sign-in/out controls,
establish durable account binding and integrate the returned transport. Never
reuse Pianoforte's container or send an Apple password to the application.

The next acceptance step is a real Apple-app/PWA sign-in and a private record
create/read/conflict round trip with the same account. Authentication and
private data must flow directly to Apple. No VPS proxy is introduced.

## Still required for the requested user flow

### PWA authentication integration (2026-09-06)

Settings now contains an optional browser-only iCloud sign-in section. It loads
Apple's SDK only after the user starts authentication, then displays Apple's
sign-in/out controls and follows authentication events without polling. Leaving
settings disposes UI subscriptions, not the Apple session or any learning data.
Reopening settings requires explicitly starting the status check again; the SDK
can reuse its persisted session. Errors never imply a deleted or empty library.

Configure the Next.js build locally in `apps/web/.env.local` (do not commit it):

```dotenv
NEXT_PUBLIC_FNF_CLOUDKIT_API_TOKEN=<JavaScript API token from password safe>
NEXT_PUBLIC_FNF_CLOUDKIT_ENVIRONMENT=development
```

These are build-time browser configuration values, not server credentials. The
JavaScript API token is necessarily visible to clients; protect it with Apple's
Allowed Origins setting. Never use an Apple password, private key, or
server-to-server key here. Neither value has been supplied by this change.
Missing/invalid configuration disables sign-in. Never default to production.

For the portable web build, explicitly export both variables in the build
environment; that builder does not load Next.js `.env.local`. Apple-local builds
compile them as empty and never show this browser login flow. Native CloudKit
runtime activation is separate.

Use Post Message and the exact allowed origin `https://flash-n-flip.com`. An
installed PWA retains its origin. A localhost test needs its own explicitly
allowed origin/token; do not allow all domains as a workaround. Next.js must be
rebuilt after changing public variables. Commit/push does not update the hosted
PWA; deploying it requires a separate authorized deployment.

This step deliberately does not call `storeForAccount`, read/write cloud records,
bind an existing local library to an account, or modify a local outbox. In
particular a successful sign-in is not proof of synchronization or backup.

Live acceptance is still required with the configured token and allowed origin:
sign in, sign out, reload, leave/reopen settings, switch accounts, cancel the Apple
popup, interrupt the network, and repeat in an installed PWA. Verify local decks
and progress remain unchanged. Token/origin configuration and public legal review
remain activation blockers; unit tests do not prove Apple's live popup behavior.

### Remaining synchronization work

- Durable account binding, local outbox/checkpoint integration and the single
  local repository projection path, including virtual cards and legacy state.
- Deck/card package upload, cloud-only listing, verified resumable media bytes,
  downloads, local eviction and migration of two already populated clients.
- Cloud reset/deletion with physical reclamation of old payloads and protection
  against simultaneous stale writes; namespace invalidation alone is not erasure.
- Legacy peer fencing, settings/library UI, status propagation and privacy text
  updates coordinated with activation.
- Native build/link verification and real iPhone/PWA/iPad offline, restart,
  account-switch and deletion acceptance. These are not covered by mock tests.

Full synchronization is deliberately not enabled. The current local app and
the disabled legacy backup adapter continue to behave as before.

## Verification of the foundation

- Domain: new wire-contract tests and package typecheck/build.
- Sync: full package test suite (including conditional publication, reversed
  delivery, duplicate IDs, interrupted publication, reset races and revisions),
  typecheck and build.
- Platform adapters: web/native adapter tests, the existing disabled-backup
  test and webstack package typecheck.
- Apple shell: existing shell tests, Swift syntax parsing for the new plugin
  and project-file plist validation. This is not a native app build or live test.

## References

- [ADR 0052](architecture/decisions/0052-icloud-library-replication.md).
- [Implementation plan](plans/icloud-library-sync.md).
- [Apple CloudKit JS saveRecords](https://developer.apple.com/documentation/cloudkitjs/cloudkit.database/saverecords):
  existing records require the fetched change tag; adapters must not force-save
  a conflicting record. The shared conflict policy decides what is retried.
