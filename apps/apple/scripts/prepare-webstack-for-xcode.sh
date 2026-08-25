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
pnpm --filter @flashcards/direct-connect-webstack build:apple-local

entrypoint="$workspace_root/packages/direct-connect-webstack/dist/index.html"
bundle="$workspace_root/packages/direct-connect-webstack/dist/app.js"
if [ ! -s "$entrypoint" ] || [ ! -s "$bundle" ]; then
  echo "error: The bundled Apple application is missing." >&2
  exit 1
fi
if [ -e "$workspace_root/packages/direct-connect-webstack/dist/connect" ] || \
   [ -e "$workspace_root/packages/direct-connect-webstack/dist/webstack-release.json" ]; then
  echo "error: Apple builds must not contain PWA handoff or peer-webstack release assets." >&2
  exit 1
fi
if rg -q 'https?://flash-n-flip\.com|/rendezvous/v1|stun:' "$bundle"; then
  echo "error: Apple bundle still contains server-assisted synchronization endpoints." >&2
  exit 1
fi

cd "$apple_root"
pnpm exec capacitor copy ios
