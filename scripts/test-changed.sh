#!/usr/bin/env bash
# test-changed.sh
# Runs vitest only for packages that changed between two git refs.
#
# Usage:
#   bash scripts/test-changed.sh [--base <ref>] [--head <ref>]
#
# Examples:
#   bash scripts/test-changed.sh                         # HEAD vs origin/main
#   bash scripts/test-changed.sh --base origin/main      # explicit base, HEAD
#   bash scripts/test-changed.sh --base main --head HEAD # named refs

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
VITEST_CONFIG=".tests/vitest.config.ts"

# ---------------------------------------------------------------------------
# Pass all args through to detect-changed-packages.sh
# ---------------------------------------------------------------------------
START_TIME=$(date +%s)
ARGS=("$@")

BASE_REF="origin/main"
HEAD_REF="HEAD"

while [ $# -gt 0 ]; do
  case "$1" in
    --base) BASE_REF="$2"; shift 2 ;;
    --head) HEAD_REF="$2"; shift 2 ;;
    *) shift ;;
  esac
done

get_changed_files() {
  if [[ "$HEAD_REF" == "WORKTREE" ]]; then
    local tracked
    local untracked
    tracked=$(git -C "$REPO_ROOT" diff --name-only "$BASE_REF")
    untracked=$(git -C "$REPO_ROOT" ls-files --others --exclude-standard)
    printf "%s\n%s\n" "$tracked" "$untracked" | awk 'NF' | sort -u
  else
    git -C "$REPO_ROOT" diff --name-only "$BASE_REF" "$HEAD_REF"
  fi
}

SCRIPT_TEST_CHANGED=0
if get_changed_files | grep -qE '^(scripts/|package\.json$)'; then
  SCRIPT_TEST_CHANGED=1
fi

echo "==> Detecting changed packages..." >&2
PACKAGES=$(bash "$SCRIPT_DIR/detect-changed-packages.sh" ${ARGS[@]+"${ARGS[@]}"}) || {
  echo "ERROR: detect-changed-packages.sh failed" >&2
  exit 1
}

echo "==> Detected: $PACKAGES" >&2
echo "" >&2

# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------
cd "$REPO_ROOT"

if [[ "$PACKAGES" == "ALL" ]]; then
  echo "==> Running ALL test suites (config change or broad impact detected)" >&2
  yarn vitest run --config "$VITEST_CONFIG"
elif [[ "$PACKAGES" != "NO_CHANGES" ]]; then
  # Build --project flags
  PROJECT_FLAGS=()
  while IFS= read -r pkg; do
    [[ -n "$pkg" ]] && PROJECT_FLAGS+=( "--project=$pkg" )
  done <<< "$PACKAGES"

  echo "==> Running tests for ${#PROJECT_FLAGS[@]} package(s):" >&2
  for flag in "${PROJECT_FLAGS[@]}"; do
    echo "    $flag" >&2
  done
  echo "" >&2

  yarn vitest run --config "$VITEST_CONFIG" "${PROJECT_FLAGS[@]}"
fi

if [[ "$SCRIPT_TEST_CHANGED" -eq 1 ]]; then
  echo "==> Running script tests" >&2
  yarn vitest run --config scripts/__tests__/vitest.config.ts
fi

if [[ "$PACKAGES" == "NO_CHANGES" && "$SCRIPT_TEST_CHANGED" -eq 0 ]]; then
  echo "No test-relevant changes detected. Skipping tests."
  exit 0
fi

END_TIME=$(date +%s)
ELAPSED=$(( END_TIME - START_TIME ))
echo "" >&2
echo "==> Done in ${ELAPSED}s" >&2
