#!/usr/bin/env bash
# detect-changed-packages.sh
# Detects which packages changed between two git refs and outputs package names.
#
# Usage:
#   bash scripts/detect-changed-packages.sh [--base <ref>] [--head <ref>]
#
# Outputs one package name per line to stdout, or the special tokens:
#   ALL         – run all test suites
#   NO_CHANGES  – nothing test-relevant changed

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------
BASE_REF="origin/main"
HEAD_REF="HEAD"

# ---------------------------------------------------------------------------
# Arg parsing
# ---------------------------------------------------------------------------
while [ $# -gt 0 ]; do
  case "$1" in
    --base)  BASE_REF="$2"; shift 2 ;;
    --head)  HEAD_REF="$2"; shift 2 ;;
    *)       echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

# ---------------------------------------------------------------------------
# Package map: "package-name|src/path/prefix"
# One entry per line; paths are relative to repo root.
# ---------------------------------------------------------------------------
PKG_MAP='bazdmeg-mcp|src/mcp-tools/bazdmeg
block-sdk|src/core/block-sdk
block-tasks|src/core/block-tasks
block-website|src/core/block-website
chess-engine|src/core/chess
code|src/frontend/monaco-editor
esbuild-wasm-mcp|src/mcp-tools/esbuild-wasm
google-analytics-mcp|src/mcp-tools/google-analytics
google-ads-mcp|src/mcp-tools/google-ads
hackernews-mcp|src/mcp-tools/hackernews
image-studio-worker|src/edge-api/image-studio-worker
mcp-auth|src/edge-api/auth
mcp-image-studio|src/mcp-tools/image-studio
mcp-server-base|src/core/server-base
openclaw-mcp|src/mcp-tools/openclaw
qa-studio|src/core/browser-automation
react-ts-worker|src/core/react-engine
shared|src/core/shared-utils
spike-app|src/frontend/platform-frontend
spike-cli|src/cli/spike-cli
spike-edge|src/edge-api/main
spike-chat|src/edge-api/spike-chat
spike-land-backend|src/edge-api/backend
spike-land-mcp|src/edge-api/spike-land
spike-review|src/mcp-tools/code-review
stripe-analytics-mcp|src/mcp-tools/stripe-analytics
state-machine|src/core/statecharts
transpile|src/edge-api/transpile
vibe-dev|src/cli/docker-dev
video|src/media/educational-videos
whatsapp-mcp|src/utilities/whatsapp'

TOTAL_PACKAGES=$(echo "$PKG_MAP" | wc -l | tr -d ' ')

# Packages that also need testing when react-ts-worker changes
REACT_CONSUMERS="code spike-app spike-land-backend transpile spike-land-mcp spike-edge spike-chat"

# ---------------------------------------------------------------------------
# Helper: lookup src path → package name
# Returns empty string if not found.
# ---------------------------------------------------------------------------
path_to_pkg() {
  local path="$1"
  echo "$PKG_MAP" | awk -F'|' -v p="$path" '$2 == p { print $1; exit }'
}

# ---------------------------------------------------------------------------
# Helper: lookup package name → src path
# ---------------------------------------------------------------------------
pkg_to_path() {
  local pkg="$1"
  echo "$PKG_MAP" | awk -F'|' -v p="$pkg" '$1 == p { print $2; exit }'
}

# ---------------------------------------------------------------------------
# Get repo root
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ---------------------------------------------------------------------------
# Get changed files
# ---------------------------------------------------------------------------
if [ "$HEAD_REF" = "WORKTREE" ]; then
  tracked_changes=$(git -C "$REPO_ROOT" diff --name-only "$BASE_REF" 2>/dev/null) || {
    echo "ERROR: git diff failed (base=$BASE_REF head=$HEAD_REF)" >&2
    exit 0
  }
  untracked_changes=$(git -C "$REPO_ROOT" ls-files --others --exclude-standard 2>/dev/null) || {
    echo "ERROR: git ls-files failed for untracked files" >&2
    exit 0
  }
  changed_files=$(printf "%s\n%s\n" "$tracked_changes" "$untracked_changes" | awk 'NF' | sort -u)
else
  changed_files=$(git -C "$REPO_ROOT" diff --name-only "$BASE_REF" "$HEAD_REF" 2>/dev/null) || {
    echo "ERROR: git diff failed (base=$BASE_REF head=$HEAD_REF)" >&2
    exit 0
  }
fi

if [ -z "$changed_files" ]; then
  echo "NO_CHANGES"
  exit 0
fi

root_package_json_requires_all() {
  if ! echo "$changed_files" | grep -qx 'package.json'; then
    return 1
  fi

  if [ "$HEAD_REF" = "WORKTREE" ]; then
    package_diff=$(git -C "$REPO_ROOT" diff -U0 "$BASE_REF" -- package.json 2>/dev/null) || {
      return 0
    }
  else
    package_diff=$(git -C "$REPO_ROOT" diff -U0 "$BASE_REF" "$HEAD_REF" -- package.json 2>/dev/null) || {
      return 0
    }
  fi

  if [ -z "$package_diff" ]; then
    return 1
  fi

  if echo "$package_diff" | grep -qE '^[+-][[:space:]]*"(dependencies|devDependencies|peerDependencies|optionalDependencies|resolutions|dependenciesMeta|workspaces|packageManager|engines|volta)"'; then
    return 0
  fi

  return 1
}

# ---------------------------------------------------------------------------
# Check for config-level ALL triggers first
# ---------------------------------------------------------------------------
if echo "$changed_files" | grep -qE '^(yarn\.lock|\.yarnrc\.yml)$'; then
  echo "ALL"
  exit 0
fi

if root_package_json_requires_all; then
  echo "ALL"
  exit 0
fi

GLOBAL_TEST_CONFIG_CHANGED=0
if echo "$changed_files" | grep -qx '.tests/vitest.config.ts'; then
  GLOBAL_TEST_CONFIG_CHANGED=1
fi

# ---------------------------------------------------------------------------
# Accumulate affected packages into a newline-separated list (tmp file)
# Using a temp file avoids subshell variable scoping issues with pipes.
# ---------------------------------------------------------------------------
TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT

ALL_TRIGGERED=0

while IFS= read -r f; do
  # .tests/<pkg>/... directory (config already handled above)
  case "$f" in
    .tests/*)
      subpath="${f#.tests/}"
      pkg_candidate="${subpath%%/*}"
      if [ -n "$pkg_candidate" ] && echo "$PKG_MAP" | grep -q "^${pkg_candidate}|"; then
        echo "$pkg_candidate" >> "$TMP"
      fi
      continue
      ;;
  esac

  # src/<category>/<pkg-dir>/... files
  case "$f" in
    src/*/*)
      # Extract first 3 path components: src/<cat>/<pkg>
      candidate=$(echo "$f" | cut -d'/' -f1-3)
      pkg=$(path_to_pkg "$candidate")
      if [ -z "$pkg" ]; then
        echo "WARNING: no package mapping for changed path: $f" >&2
        continue
      fi

      # shared triggers ALL
      if [ "$pkg" = "shared" ]; then
        ALL_TRIGGERED=1
        break
      fi

      # react-ts-worker → add itself + all react consumers
      if [ "$pkg" = "react-ts-worker" ]; then
        echo "react-ts-worker" >> "$TMP"
        for consumer in $REACT_CONSUMERS; do
          echo "$consumer" >> "$TMP"
        done
        continue
      fi

      echo "$pkg" >> "$TMP"
      ;;
    src/*)
      echo "WARNING: unexpected src path (too shallow): $f" >&2
      ;;
    # everything else is non-src, non-special — ignore silently
  esac

done <<< "$changed_files"

if [ "$ALL_TRIGGERED" -eq 1 ]; then
  echo "ALL"
  exit 0
fi

# ---------------------------------------------------------------------------
# Deduplicate
# ---------------------------------------------------------------------------
unique_pkgs=$(sort -u "$TMP")

num_affected=$(echo "$unique_pkgs" | grep -c . 2>/dev/null || echo 0)

# Empty result
if [ -z "$unique_pkgs" ] || [ "$num_affected" -eq 0 ]; then
  if [ "$GLOBAL_TEST_CONFIG_CHANGED" -eq 1 ]; then
    echo "ALL"
    exit 0
  fi
  echo "NO_CHANGES"
  exit 0
fi

# ---------------------------------------------------------------------------
# >80% of packages affected → run ALL
# ---------------------------------------------------------------------------
threshold=$(( (TOTAL_PACKAGES * 80 + 99) / 100 ))
if [ "$num_affected" -ge "$threshold" ]; then
  echo "ALL"
  exit 0
fi

# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------
echo "$unique_pkgs"
exit 0
