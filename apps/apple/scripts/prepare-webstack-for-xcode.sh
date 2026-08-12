#!/bin/sh

set -eu

apple_root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
workspace_root=$(CDPATH= cd -- "$apple_root/../.." && pwd)

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "error: pnpm is required to build the current Flash-n-Flip Webstack." >&2
  exit 1
fi

cd "$workspace_root"
pnpm --filter @flashcards/direct-connect-webstack build

release="$workspace_root/packages/direct-connect-webstack/dist/webstack-release.json"
if [ ! -s "$release" ]; then
  echo "error: Signed webstack-release.json is missing; configure the Flash-n-Flip Webstack signing key." >&2
  exit 1
fi

cd "$apple_root"
pnpm exec capacitor copy ios
