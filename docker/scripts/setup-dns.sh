#!/usr/bin/env bash
# Configure macOS resolver for *.local.spike.land → CoreDNS
set -euo pipefail

RESOLVER_FILE="/etc/resolver/local.spike.land"

if [ -f "$RESOLVER_FILE" ]; then
  echo "Resolver already configured at $RESOLVER_FILE"
  exit 0
fi

echo "Creating macOS resolver for local.spike.land..."
sudo mkdir -p /etc/resolver
echo "nameserver 127.0.0.1" | sudo tee "$RESOLVER_FILE" > /dev/null
echo "Resolver created at $RESOLVER_FILE"
echo "Verify with: scutil --dns | grep local.spike.land"
