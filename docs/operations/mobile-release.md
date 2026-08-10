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

### Personal-Team-Build ohne iCloud

Release `0.5.120` enthält absichtlich keine aktive iCloud-Capability. Das
Xcode-Projekt referenziert keine Entitlements-Datei, registriert den vorhandenen
CloudKit-Adapter nicht und zeigt deshalb weder iCloud-Backup noch
Familienfreigaben an. Der Build kann dadurch mit einem Personal Team auf eigenen
Geräten getestet werden; dessen Signierung läuft nach sieben Tagen ab.

Zur späteren Reaktivierung mit einem kostenpflichtigen Apple Developer Team
müssen der CloudKit-Container eingerichtet, `App.CloudKit.entitlements` als
Code-Signing-Entitlements aktiviert, der native Adapter und die
CKShare-Annahme wieder registriert und die reale CloudKit-Abnahmematrix
vollständig ausgeführt werden. Nur das Hinzufügen der Capability genügt nicht.

## Bundled product Webstack

The Capacitor shell bundles the same React product components used by the Web
application. Dashboard, deck editor, study, settings, help, the direct-connect
bootstrap, and the curated catalog therefore start without a remote Web
server. `@capacitor-community/sqlite` remains the native local authority.

The Webstack release is signed independently from Apple code signing. Create
the local release key once and back it up in an access-controlled secret store:

```bash
node scripts/generate-webstack-signing-key.mjs
```

The private key is written to the ignored `.secrets` directory. Only its
public Ed25519 key is committed into the bootstrap trust store. Production CI
must instead inject `FNF_WEBSTACK_SIGNING_KEY_FILE` and
`FNF_WEBSTACK_SIGNING_KEY_ID`; the private key must never enter Git, the app
bundle, CloudKit, or the VPS. A normal local build remains unsigned when no
release key is available and consequently cannot be offered to a browser.

`FNF_WEBSTACK_MINIMUM_BOOTSTRAP_VERSION` bleibt standardmäßig auf der ersten
kompatiblen Bootstrap-Protokollversion `0.5.119`. Sie wird nur angehoben, wenn
das Transfer- oder Aktivierungsprotokoll tatsächlich inkompatibel geändert
wurde. Ein normales App-Store-Patchupdate erfordert dadurch kein gleichzeitiges
VPS- oder CDN-Update der Bootstrap-Hülle.

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
pnpm --filter @flashcards/direct-connect-webstack build
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
