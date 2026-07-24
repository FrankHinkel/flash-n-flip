#!/bin/sh
set -eu
repo_root=${1:-$(git rev-parse --show-toplevel)}
test -s "$repo_root/packages/sync/src/index.ts"
test -s "$repo_root/packages/sync/src/index.test.ts"
rg -q 'mutationId' "$repo_root/packages/sync/src/index.ts"
rg -q 'cursor' "$repo_root/packages/sync/src/index.ts"
rg -q 'outbox' "$repo_root/packages/sync/src/index.ts"
