# Internal TestFlight setup — 25 October 2026

## Observed Apple state

- App Store Connect app **6826897017**, **Flash-n-Flip**, bundle ID
  `com.flash-n-flip`, team `W3MZ3XV975`, primary locale en-US,
  SKU `flash-n-flip-ios`.
- Group **FNF Intern** created with manual build assignment. The subsequent
  portal state also contains **INT Tests**; that existing group is preserved.
- Apple shows **0.5 (2)** marked **Internal / In testing**, assigned to both
  groups. The account owner's tester row shows **Installed** on iPhone 15,
  iOS 27.0.1. This is portal evidence, not a new agent-operated device test.
- The upload and schema promotion happened through Apple's UI while the setup
  was in progress. No successful command-line upload is claimed.
- CloudKit **Production** was read back: `FNFEntityV4` and `FNFAssetV4` are
  present. The missing development media type was added with `asset: ASSET`
  and `sha256: STRING` before that promotion. No records were reset or copied.
- The public release draft remains 1.0; manual release was selected and saved.
  No public review submission or public release was performed by this task.

## Material limitation of the installed build

The uploaded Xcode archive, created at 20:10, has
`FNFDistributionChannel=app-store` and `FNFCloudLibraryEnabled=false`.
Consequently **that installed build cannot activate the iCloud transport**.
The new shared **TestFlight** scheme/configuration is the correction. It uses
Release optimization without DEBUG and sets the explicit internal channel,
while preserving the user's opt-in for replication and the public Release gate.

A local archive from the corrected TestFlight scheme passed signing and bundle
identity checks. It still bears the pre-commit upload number 2 and **must not be
uploaded again**. The commit hook now reserves build 3 for the first policy
commit, preserving product baseline 0.5.0. Failed initialization commits retry
without consuming another number. No source commit was made under `!!`.

## Verification and remaining gates

| Gate                                | State              | Evidence / limit                                                                                                                                                           |
| ----------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App and internal TestFlight group   | fulfilled          | Live portal, internal build 0.5 (2), installed tester row.                                                                                                                 |
| CloudKit production schema          | fulfilled          | Production type list and media fields read back.                                                                                                                           |
| Version/commit behavior             | fulfilled          | 11 disposable Git repository tests passed, including consumed baseline and initialization retry.                                                                           |
| Distribution guards                 | fulfilled          | 5 contract tests passed: internal-only, no Xcode renumbering, profile/environment/identity rejection, reused upload ID.                                                    |
| Native shell/configuration          | fulfilled          | 35 Apple tests and TypeScript passed; TestFlight scheme/configuration produced a signed arm64 archive.                                                                     |
| Portable synchronization regression | fulfilled          | 67 focused tests across 5 cloud-library suites passed. No merge, journal, retry or scheduling rule was changed.                                                            |
| Static sync/readability guards      | fulfilled          | Sync guard passed; readability scan 0 failures. No UI styling changed for TestFlight.                                                                                      |
| Command-line distribution signing   | externally blocked | Xcode export reports No Accounts; GUI Xcode has the account and successfully uploaded the separate observed build. No local distribution identity is available to the CLI. |
| Corrected IPA export and audit      | open               | Use the existing Xcode GUI account; final check was interrupted by the locked Mac. No successful exported-IPA audit claimed.                                               |
| Corrected beta upload               | open               | Build 2 already consumed; next commit/build required. `!!` does not authorize that commit.                                                                                 |
| Real production two-device sync     | open               | Run on the corrected TestFlight binary; schema/installation evidence does not prove learning-progress or media exchange.                                                   |
| Public release gates                | open               | Existing legal/store/operator and full device acceptance items remain outside internal setup; release guard still reports the documented legacy/public blockers.           |

Implementation and repeatable commands:
[Internal TestFlight workflow](../../../operations/testflight.md).
Signed archives, provisioning profiles, IPA files and signing logs stay outside
Git. The initial archives were uncommitted; their manifests record that fact.

## Follow-up authorization

The account owner has now explicitly authorized one commit of all open FNF
changes (versioning/display, header correction and TestFlight), followed by
internal distribution of corrected Apple build 3. The gate table above records
the state before that authorization and upload. Follow-up build/IPA/upload
evidence is kept with `/tmp` / system-temporary artifacts rather than creating
an extra documentation-only commit and incrementing the build again.
