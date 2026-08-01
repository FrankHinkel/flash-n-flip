# Apple Release with Capacitor

## Local iPhone/iPad simulator

Start the complete Web development environment first:

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
development URL is supplied. The default configuration uses
`https://flash-n-flip.com`.

`apps/apple/ios` is a source artifact and stays in version control. Native
plugin changes must always be followed by `pnpm apple:sync` and an Xcode build.

## Current migration boundary

The Capacitor shell currently preserves the existing Web UI while the flows
are migrated to local repositories. `@capacitor-community/sqlite` and
SQLCipher are linked into the iOS target, but an App Store build remains
blocked until all release-critical flows use the native SQLite store and the
bundled UI works without the VPS.

The migration acceptance matrix includes:

- login and session recovery;
- normal, map, KaTeX, and media study cards;
- durable offline review outbox and process restart;
- duplicate delivery, interrupted sync, and multi-device conflicts;
- deck creation, editing, import, export, and complete local recovery;
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
