# Product versions and Apple builds

The root `package.json` is authoritative for `version` (`major.minor.build`),
`fnfVersionPolicy`, and `appleBuildNumber`. The new baseline is `0.5.0`; the first
public App Store release target is `1.0.0` (displayed as `1.0`).

Install the hooks in each checkout with `pnpm hooks:install`. The
`pre-commit` / `pre-merge-commit` hooks cover normal commits, merge commits,
and amendments. Do not bypass them with `--no-verify`. Each successful commit advances the product build and
the independent Apple upload counter once relative to HEAD. The initial policy
commit keeps the explicitly selected baseline `0.5.0`. Since the pre-commit
baseline Apple build `2` is already distributed, that first commit uses Apple
build `3`; retries remain idempotent.

The hook updates only version fields in all workspace manifests and all
Xcode configurations. It transforms the Git index and working files separately,
preserving unrelated staged and unstaged changes, including partial commits.
Conflicting unstaged version edits cause a clear error. Retrying after a failed
commit consumes the already prepared version without another increment.

Major/minor never advance automatically. Only after an explicit user request,
run `pnpm version:set 0.6` or `pnpm version:set 1.0`, then stage the version files
with the requested change. That commit starts the higher line at build `0`;
the next ordinary commit starts build `1`. An amendment creates a new commit and
also advances the build; avoid amending a release commit after its `.0` reset.
For merges use `git merge --no-commit` followed by `git commit`. An automatic
merge pauses with its version changes staged; finish it with `git commit`.
Git's automatic merge tree is computed before its hook, so this pause keeps
the version inside the merge commit. Resolve version conflicts against the
destination HEAD before continuing; do not disable the hook or retain an older
branch's build number. Rebase/cherry-pick paths that bypass commit hooks must
not be used to create newly numbered development commits.

`pnpm version:bump` is an optional, idempotent preparation for the next commit.
It does not create a commit. There is no need to run it for ordinary changes.
`pnpm version:check` checks all workspace and Xcode values. Push hooks validate
committed values without changing them; multiple commits may be pushed together.

Display uses one portable formatter: build `0` displays `major.minor`; nonzero
builds display all three components. The native splash shows this below its
motto; settings show it immediately after Terms. Protocol manifests and cache
identities retain the full three-component product version.

Apple metadata is separate: `MARKETING_VERSION` always contains `major.minor`,
`CURRENT_PROJECT_VERSION` uses the positive, monotonically increasing upload
counter. The upload counter never resets on a major/minor change. Native
`FNFProductVersion` and `FNFDisplayVersion` carry the full and formatted values.

`pnpm appstore:check` rejects nonzero product builds. Xcode's existing preparation
phase validates the same central metadata, rejects conflicting build-setting
overrides, and applies the release gate for public archives (`ACTION=install`).
The explicit `testflight-internal` channel permits development builds through
the audited internal-only export in [the TestFlight workflow](../operations/testflight.md).
Normal
device/simulator builds may use development versions. This is a local guard,
not a claim that App Store Connect or the other release gates have passed.

Run `pnpm version:test` for disposable-repository integration tests covering real
commits, failed-commit retries, partial staging, line resets and archive checks.
