#!/bin/sh
set -eu
repo_root=${1:-$(git rev-parse --show-toplevel)}
test -s "$repo_root/packages/scheduler/src/index.ts"
test -s "$repo_root/packages/scheduler/src/index.test.ts"
rg -q 'schedulerVersion' "$repo_root/packages/domain/src/index.ts"
rg -q 'mutationId' "$repo_root/packages/domain/src/index.ts"
