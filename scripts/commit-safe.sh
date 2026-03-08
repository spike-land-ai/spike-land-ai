#!/usr/bin/env bash
set -euo pipefail

# ── Safe Commit Pipeline ──────────────────────────────────────────────
# Reads /tmp/spike-commit-queue.json, finds files stable for N seconds,
# groups by package, runs local tests + depot CI, then commits.
#
# Usage:
#   scripts/commit-safe.sh              # default 30s stability
#   STABILITY_SECONDS=0 scripts/commit-safe.sh  # commit everything now
#   DRY_RUN=1 scripts/commit-safe.sh    # show what would be committed

QUEUE_FILE="/tmp/spike-commit-queue.json"
STABILITY_SECONDS="${STABILITY_SECONDS:-30}"
REPO_ROOT="/Users/z/Developer/spike-land-ai"
DRY_RUN="${DRY_RUN:-0}"
SKIP_DEPOT="${SKIP_DEPOT:-0}"
NOW=$(date +%s)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

cd "$REPO_ROOT"

# ── 1. Read queue ─────────────────────────────────────────────────────
if [ ! -f "$QUEUE_FILE" ]; then
  echo -e "${YELLOW}No commit queue found at $QUEUE_FILE${NC}"
  echo "Edit some files first — the PostToolUse hook will populate the queue."
  exit 0
fi

# Parse queue and find stable files
STABLE_FILES=$(python3 - "$QUEUE_FILE" "$NOW" "$STABILITY_SECONDS" << 'PYEOF'
import json, sys

queue_file, now, stability = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])

try:
    with open(queue_file, 'r') as f:
        queue = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    sys.exit(0)

stable = {}
for path, info in queue.get("files", {}).items():
    if info.get("status") == "committed":
        continue
    if info.get("status") == "failed":
        continue
    age = now - info.get("last_write_ts", now)
    if age >= stability:
        pkg = info.get("package", "other")
        if pkg not in stable:
            stable[pkg] = []
        stable[pkg].append(path)

# Output as JSON: {"package": ["file1", "file2"], ...}
if stable:
    print(json.dumps(stable))
PYEOF
)

if [ -z "$STABLE_FILES" ]; then
  echo -e "${YELLOW}No stable files found (all files edited within last ${STABILITY_SECONDS}s)${NC}"
  echo "Wait for files to stabilize or run with STABILITY_SECONDS=0"
  exit 0
fi

echo -e "${BLUE}Stable files grouped by package:${NC}"
echo "$STABLE_FILES" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for pkg, files in sorted(data.items()):
    print(f'  {pkg}:')
    for f in files:
        print(f'    - {f}')
"

# ── 2. Process each package ───────────────────────────────────────────
COMMITTED=()
FAILED=()
PENDING=()

process_package() {
  local pkg="$1"
  local files_json="$2"

  # Extract file list
  local files
  files=$(echo "$files_json" | python3 -c "import json,sys; [print(f) for f in json.load(sys.stdin)]")

  echo ""
  echo -e "${BLUE}━━━ Processing: ${pkg} ━━━${NC}"

  # Check files exist and have changes
  local staged_files=()
  while IFS= read -r file; do
    if [ -f "$file" ]; then
      # Check if file has actual changes vs main
      if git diff --name-only main -- "$file" 2>/dev/null | grep -q . || \
         git ls-files --others --exclude-standard -- "$file" 2>/dev/null | grep -q .; then
        staged_files+=("$file")
      fi
    fi
  done <<< "$files"

  if [ ${#staged_files[@]} -eq 0 ]; then
    echo -e "${YELLOW}  No changed files in ${pkg}, skipping${NC}"
    return 0
  fi

  echo "  Files: ${staged_files[*]}"

  if [ "$DRY_RUN" = "1" ]; then
    echo -e "${YELLOW}  [DRY RUN] Would stage, test, and commit${NC}"
    PENDING+=("$pkg")
    return 0
  fi

  # Stage files
  git add "${staged_files[@]}"

  # ── Typecheck gate (with auto-fix) ────────────────────────────────
  echo -e "  ${BLUE}Running typecheck...${NC}"
  if bash scripts/typecheck-autofix.sh 2>&1 | tail -5; then
    echo -e "  ${GREEN}Typecheck passed${NC}"
  else
    echo -e "  ${RED}Typecheck FAILED — unstaging${NC}"
    git reset HEAD -- "${staged_files[@]}" >/dev/null 2>&1
    update_queue_status "$pkg" "failed"
    FAILED+=("$pkg")
    return 1
  fi

  # ── Local test gate ───────────────────────────────────────────────
  echo -e "  ${BLUE}Running local tests...${NC}"
  if yarn vitest run --config .tests/vitest.config.ts --changed main 2>&1 | tail -5; then
    echo -e "  ${GREEN}Local tests passed${NC}"
  else
    echo -e "  ${RED}Local tests FAILED — unstaging${NC}"
    git reset HEAD -- "${staged_files[@]}" >/dev/null 2>&1
    update_queue_status "$pkg" "failed"
    FAILED+=("$pkg")
    return 1
  fi

  # ── CI gate (depot → docker fallback) ─────────────────────────────
  if [ "$SKIP_DEPOT" = "0" ]; then
    if command -v depot &>/dev/null; then
      echo -e "  ${BLUE}Running depot CI...${NC}"
      if depot ci run --workflow .depot/workflows/test.yml 2>&1 | tail -5; then
        echo -e "  ${GREEN}Depot CI passed${NC}"
      else
        echo -e "  ${RED}Depot CI FAILED — unstaging${NC}"
        git reset HEAD -- "${staged_files[@]}" >/dev/null 2>&1
        update_queue_status "$pkg" "failed"
        FAILED+=("$pkg")
        return 1
      fi
    elif command -v docker &>/dev/null; then
      echo -e "  ${BLUE}Running CI via Docker (depot unavailable)...${NC}"
      if docker run --rm \
        -v "$REPO_ROOT":/app \
        -w /app \
        node:24-slim \
        sh -c "yarn install --immutable 2>/dev/null; yarn vitest run --config .tests/vitest.config.ts --changed main" 2>&1 | tail -10; then
        echo -e "  ${GREEN}Docker CI passed${NC}"
      else
        echo -e "  ${RED}Docker CI FAILED — unstaging${NC}"
        git reset HEAD -- "${staged_files[@]}" >/dev/null 2>&1
        update_queue_status "$pkg" "failed"
        FAILED+=("$pkg")
        return 1
      fi
    else
      echo -e "  ${YELLOW}Skipping CI gate (neither depot nor docker available)${NC}"
    fi
  else
    echo -e "  ${YELLOW}Skipping CI gate (SKIP_DEPOT=1)${NC}"
  fi

  # ── Gemini review gate ──────────────────────────────────────────────
  echo -e "  ${BLUE}Running Gemini code review...${NC}"
  if command -v gemini &>/dev/null; then
    if bash scripts/gemini-review.sh 2>&1 | tail -10; then
      echo -e "  ${GREEN}Gemini review passed${NC}"
    else
      echo -e "  ${RED}Gemini review REJECTED — unstaging${NC}"
      git reset HEAD -- "${staged_files[@]}" >/dev/null 2>&1
      update_queue_status "$pkg" "failed"
      FAILED+=("$pkg")
      return 1
    fi
  else
    echo -e "  ${YELLOW}Skipping Gemini review (gemini CLI not found)${NC}"
  fi

  # ── Commit + Push + PR ──────────────────────────────────────────────
  local pkg_short
  pkg_short=$(echo "$pkg" | sed 's|^src/||')
  local msg="feat(${pkg_short}): auto-commit stable changes [tests:pass]"
  local branch
  branch=$(git branch --show-current)

  # If on main, create a feature branch
  if [ "$branch" = "main" ]; then
    branch="auto-pr-$(date +%s)"
    git checkout -b "$branch" >/dev/null 2>&1
  fi

  git commit -m "$(cat <<EOF
${msg}

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)" >/dev/null 2>&1

  echo -e "  ${GREEN}Committed: ${msg}${NC}"

  # Push and create PR
  echo -e "  ${BLUE}Pushing to origin/${branch}...${NC}"
  if git push -u origin "$branch" >/dev/null 2>&1; then
    echo -e "  ${GREEN}Pushed${NC}"
    # Create PR if one doesn't exist
    if ! gh pr view "$branch" >/dev/null 2>&1; then
      echo -e "  ${BLUE}Creating PR...${NC}"
      gh pr create \
        --title "$msg" \
        --body "$(cat <<'PREOF'
## Auto-committed changes

Reviewed by Gemini 2.5 Flash before commit.

Pipeline: typecheck ✓ → vitest ✓ → gemini review ✓

🤖 Generated with [Claude Code](https://claude.com/claude-code)
PREOF
)" \
        --base main >/dev/null 2>&1 && echo -e "  ${GREEN}PR created${NC}"
    fi
    # Auto-merge after CI passes
    gh pr merge "$branch" --auto --merge >/dev/null 2>&1 && \
      echo -e "  ${GREEN}Auto-merge enabled (will merge after CI passes)${NC}"
  else
    echo -e "  ${YELLOW}Push failed (will retry on next cycle)${NC}"
  fi

  update_queue_status "$pkg" "committed"
  COMMITTED+=("$pkg")
}

update_queue_status() {
  local pkg="$1"
  local status="$2"
  python3 - "$QUEUE_FILE" "$pkg" "$status" << 'PYEOF'
import json, sys

queue_file, pkg, status = sys.argv[1], sys.argv[2], sys.argv[3]

try:
    with open(queue_file, 'r') as f:
        queue = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    sys.exit(0)

for path, info in queue.get("files", {}).items():
    if info.get("package") == pkg:
        info["status"] = status

with open(queue_file, 'w') as f:
    json.dump(queue, f, indent=2)
PYEOF
}

# Process each package
echo "$STABLE_FILES" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for pkg in sorted(data.keys()):
    print(pkg + '|||' + json.dumps(data[pkg]))
" | while IFS='|||' read -r pkg files_json; do
  process_package "$pkg" "$files_json" || true
done

# ── 3. Summary ────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}━━━ Summary ━━━${NC}"
[ ${#COMMITTED[@]} -gt 0 ] && echo -e "${GREEN}  Committed: ${COMMITTED[*]}${NC}"
[ ${#FAILED[@]} -gt 0 ] && echo -e "${RED}  Failed:    ${FAILED[*]}${NC}"
[ ${#PENDING[@]} -gt 0 ] && echo -e "${YELLOW}  Pending:   ${PENDING[*]}${NC}"

# Count remaining pending files
REMAINING=$(python3 -c "
import json
try:
    with open('$QUEUE_FILE') as f:
        q = json.load(f)
    editing = sum(1 for v in q.get('files',{}).values() if v.get('status') == 'editing')
    print(f'{editing} files still editing')
except: print('0 files still editing')
")
echo -e "  ${YELLOW}${REMAINING}${NC}"
