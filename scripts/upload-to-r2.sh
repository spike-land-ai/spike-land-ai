#!/usr/bin/env bash
set -euo pipefail

# Usage: upload-to-r2.sh <dist-dir> <r2-bucket>
# Uploads files from dist-dir to the given R2 bucket with content-type detection,
# hashed-asset caching, and parallel upload.

DIST_DIR="${1:?Usage: upload-to-r2.sh <dist-dir> <r2-bucket>}"
R2_BUCKET="${2:?Usage: upload-to-r2.sh <dist-dir> <r2-bucket>}"
WRANGLER="${WRANGLER:-yarn wrangler}"

CACHE_DIR="${DIST_DIR}/../.deploy-cache"
mkdir -p "$CACHE_DIR"

echo "Uploading to R2 bucket: ${R2_BUCKET}..."

# Load previously uploaded keys for content-hash diffing
UPLOADED_KEYS_FILE="$CACHE_DIR/uploaded-keys-${R2_BUCKET}.txt"
touch "$UPLOADED_KEYS_FILE"

upload_file() {
  local file="$1"
  local dist="$2"
  local key="${file#${dist}/}"
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

  $WRANGLER r2 object put "${R2_BUCKET}/${key}" \
    --file "$file" \
    --content-type "$content_type" \
    --remote
}

export -f upload_file
export R2_BUCKET WRANGLER

# Build list of files to upload, skipping hashed assets already uploaded
FILES_TO_UPLOAD=()
NEW_KEYS=()
TOTAL_FILES=0

find "$DIST_DIR" -type f -print0 > "$CACHE_DIR/files.tmp"
while IFS= read -r -d '' file; do
  TOTAL_FILES=$((TOTAL_FILES + 1))
  key="${file#${DIST_DIR}/}"
  # Hashed assets (contain content hash in filename) can be skipped if already uploaded
  if [[ "$key" =~ \.[0-9a-f]{8,}\. ]] && grep -qxF "$key" "$UPLOADED_KEYS_FILE" 2>/dev/null; then
    continue
  fi
  FILES_TO_UPLOAD+=("$file")
  NEW_KEYS+=("$key")
done < "$CACHE_DIR/files.tmp"

SKIPPED=$(( TOTAL_FILES - ${#FILES_TO_UPLOAD[@]} ))
echo "Uploading ${#FILES_TO_UPLOAD[@]} files (skipped ${SKIPPED} cached)..."

if [ ${#FILES_TO_UPLOAD[@]} -gt 0 ]; then
  # Upload in parallel (4 concurrent to avoid R2 rate limits)
  printf '%s\0' "${FILES_TO_UPLOAD[@]}" | xargs -0 -P 4 -I {} bash -c 'upload_file "$@" "'"$DIST_DIR"'"' _ {}

  # Update uploaded keys cache
  printf '%s\n' "${NEW_KEYS[@]}" >> "$UPLOADED_KEYS_FILE"
  sort -u -o "$UPLOADED_KEYS_FILE" "$UPLOADED_KEYS_FILE"
fi

echo "R2 upload to ${R2_BUCKET} complete."
