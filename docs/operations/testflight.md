# Internal TestFlight for Flash-n-Flip

The first beta uses the existing Apple team `W3MZ3XV975`, bundle identifier
`com.flash-n-flip`, and private CloudKit container `iCloud.com.flash-n-flip`.
App Store Connect app: **6826897017** (Flash-n-Flip), primary language English
(US), SKU `flash-n-flip-ios`. The public release draft remains **1.0**, manually
released. The local product version starts at **0.5.0**, displayed as **0.5**.

The **FNF Intern** group uses manual build assignment. Only the existing account
owner is intended as the initial tester; no external invitations or public link
are part of this setup. Internal-only uploads cannot later be used for an
external beta or public App Store submission. Prepare a separate release for
those purposes.

## Archive, export, audit, upload

Run from the repository root with the signed-in Xcode account:

```sh
pnpm version:check
pnpm apple:testflight:test
pnpm --filter @flashcards/apple test
pnpm --filter @flashcards/apple typecheck
pnpm apple:testflight:archive
pnpm apple:testflight:export
pnpm apple:testflight:audit
pnpm apple:testflight:upload
```

All four commands optionally take an explicit artifact directory as their last
argument. The default is `FNF-<product-version>-<apple-build>-testflight` inside the
system temporary directory (`$TMPDIR` on macOS).
They never change versions, commit, or push. Reuse an existing archive for export
and upload; do not rebuild a different candidate with the same upload number.
After a failed/uncertain upload inspect App Store Connect before retrying. The
manifest records an upload request to prevent accidental retries. Signed archives,
IPAs, profiles, and signing logs remain outside Git.

The archive uses the shared **TestFlight** scheme/configuration with
`FNF_DISTRIBUTION_CHANNEL=testflight-internal` (Release optimization, without DEBUG).
This explicitly permits nonzero development builds while the normal App Store
archive path still requires build zero. The export template enables
`testFlightInternalTestingOnly`, production CloudKit, automatic signing, and
symbol upload. `manageAppVersionAndBuildNumber=false` preserves the central
Apple upload counter. Xcode handles credentials; no new API key is required.

If command-line export reports **No Accounts** while the account is visible in
Xcode, use Xcode Organizer with that existing account. Select scheme
**TestFlight → Product → Archive**, then Custom → App Store Connect → Export,
enable **TestFlight internal testing only**, and disable automatic version/build
management. Use CloudKit Production. Export locally and audit the IPA before
uploading the same archive. Do not sign out, replace credentials, or create an
API key merely to bypass a command-line credential limitation.

The exported IPA is unpacked and audited before upload: exact app/version/build,
internal channel, offline bundle, signature, production CloudKit and push
entitlements, no debugger entitlement, and an unexpired TestFlight profile.
The IPA's SHA-256 is recorded. No development server URL is accepted.

## App icon

The native `AppIcon` catalog declares individual iPhone/iPad sizes and an
explicit `ios-marketing` image at 1024 × 1024 pixels. All PNGs are generated
without alpha from `Ressourcen/Flash-n-Flip.svg`; the catalog is generated too.
The Xcode preparation phase runs `pnpm assets:brand`, so direct Organizer
archives use the current generated images. `pnpm assets:brand:check` verifies
their reproducibility.

The archive/IPA audit checks both primary icon bindings, the actual bundled
icon files and the opaque 1024-pixel marketing rendition in `Assets.car`.
A missing or transparent Store icon stops the audit before upload.

App Store Connect obtains the icon from an uploaded build; it is not a separate
PNG upload on the app record. Generate a new archive and upload the audited
candidate through the existing workflow. The app's Store draft and uploaded
TestFlight builds are separate: assigning a build to a public version must
respect its version and distribution channel. Do not change the product's
major/minor line merely to replace an icon placeholder.

Apple references: [Add an app icon](https://developer.apple.com/help/app-store-connect/manage-app-information/add-an-app-icon/),
[asset catalog configuration](https://developer.apple.com/documentation/xcode/configuring-your-app-icon),
[choose a build](https://developer.apple.com/help/app-store-connect/manage-builds/choose-a-build-to-submit/).

## CloudKit

TestFlight uses CloudKit **Production**. Deploy the current development schema
through CloudKit Console before testing sync. It must contain `FNFEntityV4`
(`json`, `hash`, `revision`, `lane`) and `FNFAssetV4` (`sha256`, `asset`). Schema
promotion copies definitions and indexes, not private development records.
Do not reset the container or copy the old test data.

The internal distribution channel permits the native iCloud transport in
Release. Users must still explicitly enable replication on each device; account
presence never activates it. The public release transport gate stays closed.
The production and development stores are separate, so an empty TestFlight cloud
is expected until a beta device explicitly replicates its local library.

Validate using the actual TestFlight build on iPhone and iPad: local import,
second-device deck download, quick learning-progress exchange, offline reviews,
restart/reconnect, and both deletion choices. Browser/simulator tests do not
replace production CloudKit device acceptance.

## Encryption and release scope

The native bundle uses Apple CloudKit/CryptoKit and WebKit Web Crypto for standard
transport, hashes, signatures, and backup encryption, with no proprietary
cryptographic algorithm. `ITSAppUsesNonExemptEncryption=false` records the exempt
implementation classification; re-evaluate it if cryptography changes.

Internal beta setup is not public-release acceptance. Existing legal/store,
accessibility, device acceptance and operations gates remain open as documented
in the release reviews. No public review submission, public testing link, or
App Store release is authorized by this workflow.

References: [Apple distribution options](https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases),
[internal testers](https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers/),
[CloudKit schema deployment](https://developer.apple.com/documentation/cloudkit/deploying-an-icloud-container-s-schema),
[encryption declarations](https://developer.apple.com/documentation/bundleresources/information-property-list/itsappusesnonexemptencryption).

## Observed first upload (2026-10-25)

App Store Connect shows **0.5 (2)** in internal testing and installed on the
account owner's iPhone. The upload and production schema promotion happened
through the existing Apple UI while this setup was in progress; no successful
command-line upload is claimed. The additional **INT Tests** group was already
present on the subsequent inspection and is preserved.

That uploaded archive uses `FNFDistributionChannel=app-store` with
`FNFCloudLibraryEnabled=false`; it cannot activate iCloud sync. The corrected
TestFlight configuration is prepared locally. Build 2 must never be uploaded
again. The first version-policy commit preserves the requested product baseline
`0.5.0` but advances the technical Apple counter to **3**, including after a
failed-commit retry. An ordinary subsequent commit advances both counters as
documented. The initial preparation was performed under `!!` without a commit.
The account owner subsequently explicitly authorized one commit of all open
FNF changes and internal distribution of corrected Apple build 3.

The production CloudKit schema was read back with `FNFEntityV4` and `FNFAssetV4`
present. Real two-device acceptance of the corrected TestFlight binary remains
open; schema presence and a successful archive alone do not establish sync parity.
