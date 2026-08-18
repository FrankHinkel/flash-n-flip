#!/bin/sh
set -eu

repo_root=${1:-$(git rev-parse --show-toplevel)}
failures=0

for file in docs/legal/privacy.de.md docs/legal/terms.de.md docs/legal/imprint.md docs/legal/data-map.md docs/legal/open-items.md; do
  if [ ! -s "$repo_root/$file" ]; then
    echo "BLOCKER: missing legal surface: $file"
    failures=$((failures + 1))
  fi
done

check_open_item() {
  marker=$1
  message=$2
  if rg -n "$marker" "$repo_root/docs/legal" >/dev/null 2>&1; then
    echo "RELEASE-BLOCKER: $message"
    failures=$((failures + 1))
  fi
}

check_open_item TODO_RETENTION "verify and limit production log fields, rotation, access, and retention."
check_open_item TODO_LEGACY_DELETION "define deletion and backup expiry for inactive legacy data."
check_open_item TODO_AV_CONTRACT "confirm the current netcup data-processing agreement."
check_open_item TODO_BUSINESS_STATUS "confirm the operator's business status."
check_open_item TODO_TAX_STATUS "confirm whether tax identifiers must be published."
check_open_item TODO_DSA_TRADER_STATUS "set the EU App Store DSA trader status."
check_open_item TODO_MINOR_POLICY "define the policy and store rating for minors."
check_open_item TODO_LEGAL_REVIEW "obtain qualified review of the final public legal texts."

exit "$failures"
