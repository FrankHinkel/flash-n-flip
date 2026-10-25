#!/bin/sh
set -eu
repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../../.." && pwd)
check_dir=$(mktemp -d "${TMPDIR:-/tmp}/fnf-cancellation.XXXXXX")
trap 'rm -rf "$check_dir"' EXIT
xcrun swiftc -parse-as-library \
  "$repo_root/apps/apple/ios/App/App/FlashNFlipSyncStore.swift" \
  "$repo_root/apps/apple/ios/App/App/FlashNFlipSyncEngine.swift" \
  "$repo_root/apps/apple/tests/native-sync-cancellation.swift" \
  -module-cache-path "$check_dir/modules" -o "$check_dir/check" -lsqlite3
"$check_dir/check"
