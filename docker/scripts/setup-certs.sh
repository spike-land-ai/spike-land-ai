#!/usr/bin/env bash
# Generate wildcard TLS certificates for local.spike.land using mkcert
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CERT_DIR="$ROOT/.dev-certs"
CERT_FILE="$CERT_DIR/local.spike.land.pem"
KEY_FILE="$CERT_DIR/local.spike.land-key.pem"

if [ -f "$CERT_FILE" ] && [ -f "$KEY_FILE" ]; then
  echo "Certificates already exist in $CERT_DIR"
  exit 0
fi

if ! command -v mkcert &>/dev/null; then
  echo "mkcert not found. Install it: brew install mkcert nss"
  exit 1
fi

# Ensure local CA is installed
mkcert -install 2>/dev/null || true

mkdir -p "$CERT_DIR"
mkcert -cert-file "$CERT_FILE" -key-file "$KEY_FILE" \
  "*.local.spike.land" local.spike.land localhost 127.0.0.1

echo "Wildcard certificates generated in $CERT_DIR"
