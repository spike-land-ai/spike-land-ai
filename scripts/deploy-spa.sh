#!/usr/bin/env bash
set -euo pipefail

# Deploy spike-app SPA to R2 bucket for serving via spike-edge
# Usage: bash scripts/deploy-spa.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SPA_DIR="$ROOT_DIR/packages/spike-web"
BUCKET="spike-app-assets"

echo "==> Note: Assuming spike-web has already been built."
DIST_DIR="$ROOT_DIR/packages/spike-web/dist"

if [ ! -d "$DIST_DIR" ]; then
  echo "ERROR: dist/ directory not found after build"
  exit 1
fi

# Inject build metadata into index.html
BUILD_SHA=$(git -C "$ROOT_DIR" log -1 --format=%H HEAD 2>/dev/null || echo "unknown")
BUILD_TIME=$(git -C "$ROOT_DIR" log -1 --format=%cI HEAD 2>/dev/null || echo "unknown")
INDEX_HTML="$DIST_DIR/index.html"
if [ -f "$INDEX_HTML" ]; then
  sed -i '' "s|</head>|<meta name=\"build-sha\" content=\"${BUILD_SHA}\" /><meta name=\"build-time\" content=\"${BUILD_TIME}\" /></head>|" "$INDEX_HTML"
  echo "==> Injected build SHA: ${BUILD_SHA:0:8}"
fi

echo "==> Uploading to R2 bucket: $BUCKET"

# Map file extensions to content types
get_content_type() {
  case "$1" in
    *.html) echo "text/html; charset=utf-8" ;;
    *.js)   echo "application/javascript; charset=utf-8" ;;
    *.mjs)  echo "application/javascript; charset=utf-8" ;;
    *.css)  echo "text/css; charset=utf-8" ;;
    *.json) echo "application/json; charset=utf-8" ;;
    *.svg)  echo "image/svg+xml" ;;
    *.png)  echo "image/png" ;;
    *.jpg|*.jpeg) echo "image/jpeg" ;;
    *.ico)  echo "image/x-icon" ;;
    *.woff) echo "font/woff" ;;
    *.woff2) echo "font/woff2" ;;
    *.ttf)  echo "font/ttf" ;;
    *.xml)  echo "application/xml" ;;
    *.webmanifest) echo "application/manifest+json" ;;
    *.wasm) echo "application/wasm" ;;
    *.map)  echo "application/json" ;;
    *.txt)  echo "text/plain" ;;
    *)      echo "application/octet-stream" ;;
  esac
}

# Upload all files from dist/
find "$DIST_DIR" -type f | while read -r file; do
  # Get relative path for key
  key="${file#$DIST_DIR/}"
  content_type=$(get_content_type "$file")

  echo "Uploading: $key ($content_type)"
  npx wrangler r2 object put "$BUCKET/$key" \
    --file "$file" \
    --content-type "$content_type" \
    --remote &
done
  wait

echo ""
echo "==> SPA uploaded to R2 bucket: $BUCKET"
echo "==> Deploy spike-edge to serve SPA:"
echo "    cd src/spike-edge && npm run deploy"
