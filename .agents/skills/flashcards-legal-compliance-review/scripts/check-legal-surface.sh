#!/bin/sh
set -eu

repo_root=${1:-$(git rev-parse --show-toplevel)}
failures=0

for file in docs/legal/privacy.de.md docs/legal/terms.de.md docs/legal/imprint.md docs/legal/data-map.md; do
  if [ ! -s "$repo_root/$file" ]; then
    echo "BLOCKER: missing legal surface: $file"
    failures=$((failures + 1))
  fi
done

if rg -n 'TODO_OPERATOR|TODO_HOSTING|TODO_RETENTION|TODO_LEGAL_CONTACT' "$repo_root/docs/legal" >/dev/null 2>&1; then
  echo "RELEASE-BLOCKER: unresolved operator, hosting, retention, or legal contact."
  failures=$((failures + 1))
fi

exit "$failures"
