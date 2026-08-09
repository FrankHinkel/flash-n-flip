#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"

printf 'WARNUNG: Release-Readiness- und Legal-Blocker werden übersprungen.\n' >&2
printf 'Technische Quell-, Bundle-, Rendezvous- und Health-Prüfungen bleiben aktiv.\n\n' >&2

exec "$SCRIPT_DIR/flashnflipDeployVPS.sh" \
  --skip-release-check \
  --yes \
  "$@"
