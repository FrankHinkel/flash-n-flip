#!/bin/sh
set -eu
repo_root=${1:-$(git rev-parse --show-toplevel)}

"$repo_root/.agents/skills/flashcards-legal-compliance-review/scripts/check-legal-surface.sh" "$repo_root"
"$repo_root/.agents/skills/flashcards-learning-integrity-review/scripts/check-learning-integrity.sh" "$repo_root"
"$repo_root/.agents/skills/flashcards-offline-sync-review/scripts/check-sync-integrity.sh" "$repo_root"
"$repo_root/.agents/skills/flashcards-community-publishing-review/scripts/check-publishing-guardrails.sh" "$repo_root"
"$repo_root/.agents/skills/flashcards-content-security-review/scripts/check-content-security.sh" "$repo_root"

test -s "$repo_root/docs/operations/backup-restore.md"
test -s "$repo_root/docs/operations/release-runbook.md"
test -s "$repo_root/docs/accessibility.md"
