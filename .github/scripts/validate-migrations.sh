#!/usr/bin/env bash
set -euo pipefail

# Validate D1 migration SQL files for zero-downtime risks.
# Currently a stub — can be enhanced to check for DROP TABLE, ALTER COLUMN, etc.

echo "Validating D1 migrations..."

MIGRATIONS_DIR="packages/spike-land-mcp/migrations"
if [ -d "$MIGRATIONS_DIR" ]; then
  RISKY=$(grep -ril 'DROP TABLE\|DROP COLUMN\|RENAME TABLE' "$MIGRATIONS_DIR" 2>/dev/null || true)
  if [ -n "$RISKY" ]; then
    echo "WARNING: Potentially risky migrations detected:"
    echo "$RISKY"
    echo "Review these before deploying."
  fi
fi

echo "Migration validation: OK"
