# Apple Release with Capacitor

## Local iPhone/iPad simulator

For release acceptance, start with the bundled local application:

```bash
pnpm apple:sync
pnpm apple:open
```

This path needs no Web or database server. Test airplane-mode cold start,
SQLite persistence and reopen on a real device. A remote development WebView
does not establish parity with the bundled release.

For optional Web development only, start the Web environment:

```bash
./flashnflipStart.sh --keep-db
```

In a second terminal, point the Capacitor WebView at the local Next.js UI,
synchronize plugins and assets, and open Xcode:

```bash
CAPACITOR_SERVER_URL=http://127.0.0.1:3000 pnpm apple:sync
pnpm apple:open
```

For a physical iPhone or iPad, replace `127.0.0.1` with the LAN address printed
by `flashnflipStart.sh`. Plain HTTP is enabled only when an explicit HTTP
development URL is supplied. Release builds must not set
`CAPACITOR_SERVER_URL`; the default configuration uses only the checked local
bundle.

`apps/apple/ios` is a source artifact and stays in version control. Native
plugin changes must always be followed by `pnpm apple:sync` and an Xcode build.
`pnpm apple:sync` regenerates the brand assets and curated catalog, builds the
complete local Apple application bundle, and only then copies it into the Xcode
project. Do not replace it with a direct `capacitor sync`: that can package a
stale shell without the bundled Discover collections.

### Current iCloud boundary (reviewed 2026-09-30)

Both Xcode configurations reference `App.CloudKit.entitlements`; the scene
registers the CloudKit adapters. The cloud-library account adapter nevertheless
returns `NOT_CONFIGURED` unless `FNFCloudLibraryEnabled` is explicitly true in
Info.plist. That flag is currently absent. Do not describe this project as an
entitlement-free Personal Team build or as accepted iCloud synchronization.

The repository instructions require direct peer replication and prohibit a
second live CloudKit authority, while later ADRs describe an Apple-only cloud
direction. Resolve this product/architecture conflict before enabling a flag
or promising synchronization in store metadata. A capability, an account check
and a successful simulator compilation cannot replace two-device acceptance.

## Bundled Apple application

The Capacitor shell bundles the same React product components used by the Web
application. Dashboard, deck editor, study, settings, offline help and the
curated starter catalog therefore start without a remote Web server.
`@capacitor-community/sqlite` remains the native local authority.

`pnpm apple:sync` builds the portable entrypoint with
`FNF_APPLE_LOCAL_ONLY=1`. The build fails if it produces a Connect directory,
a peer Webstack release manifest, or executable JavaScript containing
`flash-n-flip.com`, `/rendezvous/v1` or `stun:`. Capacitor then copies this
checked output into Xcode. The Apple target has no WebRTC package dependency
and does not enable Capacitor's native HTTP bridge.

`pnpm curated:bundle` verwendet denselben kontrollierten Ed25519-Schlüssel für
ein getrenntes Katalog-Signaturmanifest. Ein Release darf weder einen neuen
Katalog noch einen neuen öffentlichen Vertrauensanker allein ausrollen. Bei
einer Rotation wird zuerst ein App-/Bootstrap-Release mit altem und neuem
öffentlichen Schlüssel verteilt, anschließend mit dem neuen privaten Schlüssel
signiert und der alte Schlüssel erst nach Ablauf des Kompatibilitätsfensters
entfernt. `pnpm curated:bundle:check` weist einen veralteten, manipulierten oder
ohne passenden Schlüssel erzeugten Katalog zurück.

App updates are distributed only through Apple. The Web/PWA and peer-delivered
Webstack source remains parked for later evaluation and must not be copied into
the Apple archive.

The migration acceptance matrix includes:

- normal, map, KaTeX, and media study cards;
- durable local reviews and process restart;
- deck creation, editing, import, export, and complete local recovery;
- local APKG/FNF/CSV import with original-media retention and interrupted
  staging recovery;
- curated catalog hash/signature verification and overlapping key rotation;
- bundle denylist and airplane-mode cold start;
- complete FNF restore on a fresh second Apple device;
- bright/dark appearance, enlarged text, and iPhone/iPad layouts.

## Prerequisites

- current Xcode and iOS SDK;
- Apple Developer Team and App Store Connect application;
- signing profile for the preserved bundle identifier `com.flash-n-flip`;
- completed privacy labels, screenshots, support URL, age rating, and legal
  operator data;
- passed repository and release checks.

## Reproducible build

```bash
pnpm install --frozen-lockfile
pnpm --filter @flashcards/apple test
pnpm --filter @flashcards/apple typecheck
pnpm apple:sync
xcodebuild \
  -project apps/apple/ios/App/App.xcodeproj \
  -scheme App \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  build
```

Archive and upload are performed in Xcode only after `pnpm release:check`
passes and the physical-device acceptance matrix is complete.
