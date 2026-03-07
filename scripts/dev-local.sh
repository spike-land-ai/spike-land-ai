#!/usr/bin/env bash
# Start local.spike.land development environment with HTTPS
#
# Prerequisites:
#   1. mkcert installed: brew install mkcert nss
#   2. Local CA installed: mkcert -install
#   3. /etc/hosts entry: 127.0.0.1 local.spike.land
#
# Usage: bash scripts/dev-local.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CERT_DIR="$ROOT/.dev-certs"
CERT_FILE="$CERT_DIR/local.spike.land.pem"
KEY_FILE="$CERT_DIR/local.spike.land-key.pem"

# Check /etc/hosts
if ! grep -q 'local\.spike\.land' /etc/hosts 2>/dev/null; then
  echo "Missing /etc/hosts entry. Run:"
  echo "  sudo bash -c 'echo \"127.0.0.1 local.spike.land\" >> /etc/hosts'"
  exit 1
fi

# Generate certs if missing
if [ ! -f "$CERT_FILE" ] || [ ! -f "$KEY_FILE" ]; then
  echo "Generating TLS certificates..."
  if ! command -v mkcert &>/dev/null; then
    echo "mkcert not found. Install it: brew install mkcert nss"
    exit 1
  fi
  mkdir -p "$CERT_DIR"
  mkcert -cert-file "$CERT_FILE" -key-file "$KEY_FILE" \
    local.spike.land localhost 127.0.0.1
  echo "Certificates generated in $CERT_DIR"
fi

cleanup() {
  echo "Shutting down..."
  kill $PID_EDGE $PID_APP $PID_SYNC 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Starting spike-edge on https://local.spike.land:8787 ..."
(cd "$ROOT/packages/spike-edge" && npx wrangler dev --local-protocol=https \
  --https-key-path="$KEY_FILE" \
  --https-cert-path="$CERT_FILE") &
PID_EDGE=$!

echo "Starting spike-app on https://local.spike.land:5173 ..."
(cd "$ROOT/packages/spike-app" && npm run dev) &
PID_APP=$!

echo ""
echo "  spike-app:  https://local.spike.land:5173"
echo "  spike-edge: https://local.spike.land:8787"
echo ""

echo "Starting auto-sync..."
bash "$ROOT/scripts/auto-sync.sh" &
PID_SYNC=$!


wait
