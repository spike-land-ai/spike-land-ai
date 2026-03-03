#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

R2_BUCKET="spike-app-assets"
VERSION_URL="https://spike.land/version"

# ── 1. Current HEAD info ──
HEAD_SHA="$(git rev-parse HEAD)"
COMMIT_TIME="$(git log -1 --format=%cI HEAD)"

echo "HEAD: ${HEAD_SHA}"
echo "Commit time: ${COMMIT_TIME}"

# ── 2. Check deployed version ──
DEPLOYED_SHA=""
if [ "${FORCE_DEPLOY:-}" != "1" ]; then
  DEPLOYED_SHA="$(
    curl -sf --max-time 5 "$VERSION_URL" \
      | python3 -c "import sys,json; print(json.load(sys.stdin).get('sha',''))" 2>/dev/null
  )" || DEPLOYED_SHA=""

  if [ "$DEPLOYED_SHA" = "$HEAD_SHA" ]; then
    echo "Deployed SHA matches HEAD — nothing to do."
    exit 0
  fi

  echo "Deployed SHA: ${DEPLOYED_SHA:-<unknown>}"
fi

# ── 3. Build caching via tree hash ──
CACHE_DIR=".deploy-cache"
mkdir -p "$CACHE_DIR"

# Hash the spike-app source tree (excludes node_modules, dist, etc. via .gitignore)
TREE_HASH="$(git ls-tree -r HEAD -- . | git hash-object --stdin)"
CACHED_HASH=""
if [ -f "$CACHE_DIR/app.treehash" ]; then
  CACHED_HASH="$(cat "$CACHE_DIR/app.treehash")"
fi

# Also hash block-website content (blog posts flow through it)
CONTENT_HASH="$(git ls-tree -r HEAD -- ../block-website/src/core/generated-posts.ts 2>/dev/null | git hash-object --stdin 2>/dev/null || echo "none")"
CACHED_CONTENT=""
if [ -f "$CACHE_DIR/content.treehash" ]; then
  CACHED_CONTENT="$(cat "$CACHE_DIR/content.treehash")"
fi

NEED_BUILD=false
if [ "$TREE_HASH" != "$CACHED_HASH" ] || [ ! -d "dist" ]; then
  NEED_BUILD=true
fi
if [ "$CONTENT_HASH" != "$CACHED_CONTENT" ]; then
  echo "Blog content changed — rebuilding block-website..."
  (cd ../block-website && npm run build)
  # Clear Vite dep cache so it picks up new block-website dist
  rm -rf node_modules/.vite
  NEED_BUILD=true
fi

if [ "$NEED_BUILD" = true ]; then
  echo "Building spike-app..."
  npm run build
  echo "$TREE_HASH" > "$CACHE_DIR/app.treehash"
  echo "$CONTENT_HASH" > "$CACHE_DIR/content.treehash"
else
  echo "Source unchanged (tree hash: ${TREE_HASH:0:12}) — skipping build."
fi

# ── 4. Inject build metadata into index.html ──
sed -i.bak "s|</head>|<meta name=\"build-sha\" content=\"${HEAD_SHA}\" /><meta name=\"build-time\" content=\"${COMMIT_TIME}\" /></head>|" dist/index.html
rm -f dist/index.html.bak

# ── 5. Upload dist/ to R2 ──
echo "Uploading to R2 bucket: ${R2_BUCKET}..."

upload_file() {
  local file="$1"
  local key="${file#dist/}"
  local content_type

  case "$file" in
    *.html) content_type="text/html; charset=utf-8" ;;
    *.js)   content_type="application/javascript" ;;
    *.css)  content_type="text/css" ;;
    *.json) content_type="application/json" ;;
    *.svg)  content_type="image/svg+xml" ;;
    *.png)  content_type="image/png" ;;
    *.ico)  content_type="image/x-icon" ;;
    *.txt)  content_type="text/plain" ;;
    *.xml)  content_type="application/xml" ;;
    *.woff2) content_type="font/woff2" ;;
    *.woff) content_type="font/woff" ;;
    *.map)  content_type="application/json" ;;
    *)      content_type="application/octet-stream" ;;
  esac

  yarn wrangler r2 object put "${R2_BUCKET}/${key}" \
    --file "$file" \
    --content-type "$content_type" \
    --remote
}

export -f upload_file
export R2_BUCKET

find dist -type f -print0 | xargs -0 -P 8 -I {} bash -c 'upload_file "$@"' _ {}

echo "Deployed ${HEAD_SHA:0:12} @ ${COMMIT_TIME}"
