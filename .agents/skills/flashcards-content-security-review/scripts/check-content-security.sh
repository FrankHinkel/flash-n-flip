#!/bin/sh
set -eu
repo_root=${1:-$(git rev-parse --show-toplevel)}
test -s "$repo_root/packages/domain/src/content.ts"
test -s "$repo_root/packages/domain/src/content.test.ts"
rg -q 'javascript:' "$repo_root/packages/domain/src/content.test.ts"
rg -q 'script' "$repo_root/packages/domain/src/content.test.ts"
