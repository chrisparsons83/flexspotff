#!/usr/bin/env bash
# Prints only the error lines from the failed jobs of a GitHub Actions run.
#
# Usage: npm run ci:failures -- <run-id>
#        npm run ci:failures            # latest run on the current branch

set -euo pipefail

run=${1:-}
if [ -z "$run" ]; then
  run=$(gh run list --limit 1 --json databaseId --jq '.[0].databaseId')
fi

failed=$(gh run view "$run" --json jobs --jq \
  '.jobs[] | select(.conclusion == "failure") | "\(.databaseId)\t\(.name)"')

if [ -z "$failed" ]; then
  echo "No failed jobs in run $run"
  exit 0
fi

while IFS=$'\t' read -r id name; do
  echo
  echo "== $name =="
  gh run view "$run" --job "$id" --log 2>/dev/null |
    grep -E '##\[error\]' |
    sed -E 's/^.*##\[error\]//' |
    head -20
done <<< "$failed"
