#!/usr/bin/env bash
set -uo pipefail

# Gemini Code Review Gate
# Pipes staged diff to gemini CLI for review.
# Exit 0 = approved, Exit 1 = rejected/error

DIFF=$(git diff --cached)
if [ -z "$DIFF" ]; then
  echo "No staged changes to review."
  exit 0
fi

REVIEW_PROMPT="Review this git diff for a TypeScript monorepo.
Check for: type safety, security issues, obvious bugs, broken imports.
If the changes look good, respond with exactly 'APPROVED' on the first line.
If there are issues, respond with 'REJECTED' on the first line, then list the issues.

Diff:
${DIFF}"

RESULT=$(echo "$REVIEW_PROMPT" | gemini -m gemini-2.5-flash 2>&1)

FIRST_LINE=$(echo "$RESULT" | head -1 | tr -d '[:space:]')
if [[ "$FIRST_LINE" == *"APPROVED"* ]]; then
  echo "Gemini review: APPROVED"
  echo "$RESULT" | tail -n +2  # print any notes
  exit 0
else
  echo "Gemini review: REJECTED"
  echo "$RESULT"
  exit 1
fi
