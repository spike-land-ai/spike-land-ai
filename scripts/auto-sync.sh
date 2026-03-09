#!/usr/bin/env bash
set -euo pipefail
echo "[auto-sync] Starting automated git workflow background task."
if ! command -v gh &> /dev/null; then
  echo "[auto-sync] Error: 'gh' CLI not found."
  exit 1
fi
sleep 5
while true; do
  git fetch origin main >/dev/null 2>&1 || true
  CURRENT_BRANCH=$(git branch --show-current)
  if [ "$CURRENT_BRANCH" != "main" ] && [ -n "$CURRENT_BRANCH" ]; then
    PR_STATE=$(gh pr view "$CURRENT_BRANCH" --json state -q .state 2>/dev/null || echo "NONE")
    if [ "$PR_STATE" = "MERGED" ]; then
      echo "[auto-sync] PR is merged! Switching to main and pulling..."
      git checkout main
      git pull origin main
      git branch -D "$CURRENT_BRANCH" || true
      CURRENT_BRANCH="main"
    fi
  fi
  if [ -n "$(git status --porcelain)" ]; then
    echo "[auto-sync] Changes detected. Syncing..."
    if [ "$CURRENT_BRANCH" = "main" ]; then
      NEW_BRANCH="auto-pr-$(date +%s)"
      git checkout -b "$NEW_BRANCH"
      CURRENT_BRANCH="$NEW_BRANCH"
    fi
    git add .
    # Run incremental quality gates — unstage and skip commit on failure
    if ! yarn typecheck; then
      echo "[auto-sync] typecheck failed, skipping commit"
      git reset HEAD . >/dev/null 2>&1
      continue
    fi
    if ! yarn lint; then
      echo "[auto-sync] lint failed, skipping commit"
      git reset HEAD . >/dev/null 2>&1
      continue
    fi
    if ! yarn test:src; then
      echo "[auto-sync] tests failed, skipping commit"
      git reset HEAD . >/dev/null 2>&1
      continue
    fi
    git commit -m "chore: auto-sync local changes $(date +%s)" || true
    git push -u origin "$CURRENT_BRANCH" >/dev/null 2>&1 || true
    if ! gh pr view "$CURRENT_BRANCH" >/dev/null 2>&1; then
      gh pr create \
        --title "Auto PR: $CURRENT_BRANCH" \
        --body "Automated PR from local development environment." \
        --base main >/dev/null 2>&1 || true
    fi
    gh pr merge "$CURRENT_BRANCH" --auto --merge >/dev/null 2>&1 || true
  else
    if [ "$CURRENT_BRANCH" = "main" ]; then
      git pull origin main >/dev/null 2>&1 || true
    else
      git pull origin "$CURRENT_BRANCH" >/dev/null 2>&1 || true
    fi
  fi
  sleep 15
done
