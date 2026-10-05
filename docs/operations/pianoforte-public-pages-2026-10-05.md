# Pianoforte public-page correction, 5 October 2026

The owner explicitly authorized the remaining Pianoforte App Store preparation,
its push, and the targeted VPS deployment with `!!!!!`. This update corrects the
already public Pianoforte privacy/support pages; it does not launch Flash-n-Flip
as a generally released product. Its legal/release checklist remains open.

## Source and scope

Production was verified at `9f8dddf1593135f742abdf0100362b13a1b60d2c`, version
0.5.179. Local Flash-n-Flip main was `57f44ec71caed793dca0c761ec216a4ec79a768f`
with 157 differing files; deploying main would include unrelated app changes.
The isolated branch `codex/pianoforte-store-privacy` starts at the exact production
commit. Its only functional changes are the two Pianoforte public pages and
bounded Docker operating/error logs for the Web and Caddy containers.
Version manifests advance to 0.5.180, with focused public-page coverage.

Caddy's running adapted configuration had no HTTP access-log configuration.
The Web/Caddy json-file log drivers had no rotation options. The new settings
limit each container to three files of 10 MB. This is a size limit, not a guaranteed
number of days; the public policy says so. API and STUN logging, persistent
volumes, backups, secrets and inactive legacy data are outside this change.

## Verification and delivery

Frozen dependency installation, three public-page tests, full monorepo build
and typecheck passed. Compose was parsed and Web/Caddy logging and service
health dependencies checked. Inspect the public pages in Chrome after deployment;
confirm HTTP 200, bilingual content, correct mailto/navigation, and narrow layout.
Inspect only safe Docker log-driver options and last-successful deployment metadata.
Never print production environment files or tokens.

Use the existing documented private-test exception in
[private-web-deployment.md](private-web-deployment.md):

```bash
FNF_DEPLOY_BRANCH=codex/pianoforte-store-privacy ./flashnflipDeployNoBlock.sh
```

The general `pnpm release:check` still reports eight Flash-n-Flip legal/readiness
items. This exception retains clean/exact origin source, version, image build,
API/STUN health and retired-route checks. It is used for a corrective update of
Pianoforte pages within that existing private Flash-n-Flip test deployment;
no global release checklist item is closed or bypass code changed.

The netcup AVV is a hosting contract, not a separate contract for each app.
The owner confirmed that no netcup AVV has yet been concluded. The agreement
must be completed by the owner before the public-release hosting check can close.
The prepared deployment has not been invoked while that step is pending. Public
netcup documentation describes where the contract is available; it does not
prove this customer's contract. Support-mail deletion is the stated provider
policy, not a measured claim about the mailbox. No test email was sent.

After successful delivery, record the exact commit/version and rollback commit
in Pianoforte's release evidence. Keep the branch available so its page/log fixes
can be integrated into future Flash-n-Flip main deployments without accidentally
rolling back this correction.
