#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:-all}"
echo "Rollback requested for: ${TARGET}"
echo "WARNING: Automated rollback not yet implemented."
echo "Manual rollback steps:"
echo "  1. Identify the last known-good commit SHA"
echo "  2. Run: git checkout <sha> -- packages/"
echo "  3. Re-deploy affected workers with: cd packages/<worker> && npm run deploy"
