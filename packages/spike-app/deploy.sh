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

NEED_BUILD=false
if [ "$TREE_HASH" != "$CACHED_HASH" ] || [ ! -d "dist" ]; then
  NEED_BUILD=true
fi

if [ "$NEED_BUILD" = true ]; then
  echo "Building spike-app..."
  npx vite build
  echo "$TREE_HASH" > "$CACHE_DIR/app.treehash"
else
  echo "Source unchanged (tree hash: ${TREE_HASH:0:12}) — skipping build."
fi

# ── 4. Inject build metadata into index.html ──
sed -i.bak "s|</head>|<meta name=\"build-sha\" content=\"${HEAD_SHA}\" /><meta name=\"build-time\" content=\"${COMMIT_TIME}\" /></head>|" dist/index.html
rm -f dist/index.html.bak

# ── 5. Archive current build in R2 for rollback ──
if [ -n "$DEPLOYED_SHA" ] && [ "$DEPLOYED_SHA" != "unknown" ]; then
  echo "Archiving current build (${DEPLOYED_SHA:0:12}) to builds/${DEPLOYED_SHA}/..."
  # Copy root assets to builds/{sha}/ prefix
  LIST_OUTPUT="$(yarn wrangler r2 object list "${R2_BUCKET}" --remote 2>/dev/null || echo "")"
  if [ -n "$LIST_OUTPUT" ]; then
    echo "$LIST_OUTPUT" | python3 -c "
import sys, json
try:
  data = json.load(sys.stdin)
  for obj in data.get('objects', data) if isinstance(data, dict) else data:
    key = obj.get('key', '') if isinstance(obj, dict) else ''
    if key and not key.startswith('builds/') and not key.startswith('blog/'):
      print(key)
except: pass
" | while read -r key; do
      yarn wrangler r2 object copy "${R2_BUCKET}/${key}" "${R2_BUCKET}/builds/${DEPLOYED_SHA}/${key}" --remote 2>/dev/null || true
    done
  fi

  # Prune old builds — keep only the 5 most recent
  EXISTING_BUILDS="$(yarn wrangler r2 object list "${R2_BUCKET}" --prefix "builds/" --remote 2>/dev/null || echo "")"
  if [ -n "$EXISTING_BUILDS" ]; then
    OLD_SHAS="$(echo "$EXISTING_BUILDS" | python3 -c "
import sys, json
try:
  data = json.load(sys.stdin)
  objs = data.get('objects', data) if isinstance(data, dict) else data
  shas = sorted(set(
    obj.get('key','').split('/')[1]
    for obj in (objs if isinstance(objs, list) else [])
    if isinstance(obj, dict) and obj.get('key','').startswith('builds/') and len(obj['key'].split('/')) > 2
  ))
  # Print SHAs to delete (all except last 5)
  for sha in shas[:-5]:
    print(sha)
except: pass
")"
    for old_sha in $OLD_SHAS; do
      echo "Pruning old build: ${old_sha:0:12}..."
      yarn wrangler r2 object delete "${R2_BUCKET}/builds/${old_sha}/" --remote 2>/dev/null || true
    done
  fi
fi

# ── 6. Upload new dist/ to R2 ──
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

find dist -type f -print0 | xargs -0 -P 1 -I {} bash -c 'upload_file "$@"' _ {}

# ── 7. Seed blog posts to D1 and upload images to R2 ──
echo "Seeding blog content to D1 + R2..."
(cd ../.. && npx tsx scripts/seed-blog.ts --remote)

echo "Deployed ${HEAD_SHA:0:12} @ ${COMMIT_TIME}"
