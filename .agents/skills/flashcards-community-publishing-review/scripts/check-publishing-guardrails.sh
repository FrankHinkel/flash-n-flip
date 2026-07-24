#!/bin/sh
set -eu
repo_root=${1:-$(git rev-parse --show-toplevel)}
test -s "$repo_root/apps/api/src/services/publication-service.ts"
test -s "$repo_root/apps/api/src/services/publication-service.test.ts"
rg -q 'APPROVED' "$repo_root/packages/domain/src/index.ts"
rg -q 'PUBLISHED' "$repo_root/packages/domain/src/index.ts"
rg -q 'admin' "$repo_root/apps/api/src/services/publication-service.ts"
rg -q 'audit' "$repo_root/apps/api/src/services/publication-service.ts"
