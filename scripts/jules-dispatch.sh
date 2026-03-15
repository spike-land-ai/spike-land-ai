#!/bin/bash
# jules-dispatch.sh — Dispatch tasks to Jules (GitHub's AI agent)
# Uses your GitHub/Jules allowance instead of Claude Code tokens.
#
# Usage:
#   ./scripts/jules-dispatch.sh "Fix the TypeScript errors in math-engine"
#   ./scripts/jules-dispatch.sh "Add unit tests for stripe-analytics" --label "tests"
#   ./scripts/jules-dispatch.sh --list          # List open Jules issues
#   ./scripts/jules-dispatch.sh --status        # Check Jules PR status
#
# Jules reads the issue body as its prompt. Good prompts = good results.

set -euo pipefail

REPO="spike-land-ai/spike-land-ai"
JULES_LABEL="jules"

# Ensure jules label exists
ensure_label() {
  gh label create "$JULES_LABEL" --repo "$REPO" \
    --description "Task for Jules AI agent" \
    --color "7057ff" 2>/dev/null || true
}

# List open Jules issues
list_issues() {
  echo "=== Open Jules Issues ==="
  gh issue list --repo "$REPO" --label "$JULES_LABEL" --state open --limit 20
  echo ""
  echo "=== Jules PRs ==="
  gh pr list --repo "$REPO" --label "$JULES_LABEL" --state open --limit 20
}

# Check status of Jules work
check_status() {
  echo "=== Jules PRs (open) ==="
  gh pr list --repo "$REPO" --label "$JULES_LABEL" --state open --json number,title,headRefName,createdAt \
    --template '{{range .}}#{{.number}} {{.title}} ({{.headRefName}}) - {{timeago .createdAt}}{{"\n"}}{{end}}'
  echo ""
  echo "=== Jules PRs (merged last 7 days) ==="
  gh pr list --repo "$REPO" --label "$JULES_LABEL" --state merged --limit 10 --json number,title,mergedAt \
    --template '{{range .}}#{{.number}} {{.title}} - merged {{timeago .mergedAt}}{{"\n"}}{{end}}'
}

# Dispatch a task to Jules
dispatch() {
  local task="$1"
  local extra_label="${2:-}"

  # Build the issue body with context Jules needs
  local body
  body=$(cat <<PROMPT
## Task for Jules

${task}

## Context

- **Monorepo**: All source code lives under \`src/\` (not \`packages/\`)
- **TypeScript strict mode**: \`noUncheckedIndexedAccess\`, \`exactOptionalPropertyTypes\` enabled
- **Testing**: Use Vitest. Run tests with \`npx vitest run --config .tests/vitest.config.ts --project <package-name>\`
- **Linting**: ESLint config at root. No \`eslint-disable\`, \`@ts-ignore\`, or \`@ts-nocheck\`
- **Types**: Never use \`any\` — use \`unknown\` or proper types
- **Style**: Keep changes minimal and focused. Don't add unnecessary comments or docstrings.

## Key Directories

| Directory | Purpose |
|-----------|---------|
| \`src/edge-api/\` | Cloudflare Workers (Hono) |
| \`src/mcp-tools/\` | MCP servers |
| \`src/frontend/\` | React SPAs |
| \`src/core/\` | Shared core packages |
| \`.tests/\` | Vitest config + test overrides |

## Acceptance Criteria

- [ ] TypeScript compiles without errors
- [ ] All existing tests still pass
- [ ] New code has test coverage where applicable
- [ ] No \`any\` types, no eslint-disable comments

---
*Dispatched via jules-dispatch.sh*
PROMPT
  )

  ensure_label

  local labels="$JULES_LABEL"
  if [ -n "$extra_label" ]; then
    labels="$JULES_LABEL,$extra_label"
  fi

  local title
  # Truncate task to 70 chars for title
  if [ ${#task} -gt 70 ]; then
    title="${task:0:67}..."
  else
    title="$task"
  fi

  gh issue create --repo "$REPO" \
    --title "$title" \
    --body "$body" \
    --label "$labels" \
    --assignee "@me"

  echo ""
  echo "Issue created. Go to https://githubnext.com/projects/jules to assign Jules to it."
}

# Parse args
case "${1:-}" in
  --list|-l)
    list_issues
    ;;
  --status|-s)
    check_status
    ;;
  --help|-h)
    head -12 "$0" | tail -9
    ;;
  "")
    echo "Usage: ./scripts/jules-dispatch.sh \"Your task description\""
    echo "       ./scripts/jules-dispatch.sh --list"
    echo "       ./scripts/jules-dispatch.sh --status"
    exit 1
    ;;
  *)
    EXTRA=""
    if [ "${2:-}" = "--label" ] && [ -n "${3:-}" ]; then
      EXTRA="$3"
    fi
    dispatch "$1" "$EXTRA"
    ;;
esac
