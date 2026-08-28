#!/usr/bin/env bash

set -euo pipefail

output="$(pnpm --filter @glapi/database db:push --force 2>&1)"
printf '%s\n' "$output"

if grep -Eq '(^|[[:space:]])error:|DrizzleQueryError|ERR_PNPM' <<<"$output"; then
  echo "Schema push reported an error even though the underlying CLI returned success." >&2
  exit 1
fi

if ! grep -Eq 'Changes applied|No changes detected' <<<"$output"; then
  echo "Schema push did not report a recognized success state." >&2
  exit 1
fi
