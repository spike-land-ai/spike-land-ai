#!/usr/bin/env bash
# ─── Cloudflare External Health Checks Setup ───
#
# Configures 6 HTTP health checks via Cloudflare API for spike.land workers.
# Pro plan allows up to 10 checks. Each check pings a /health endpoint and
# matches "status":"ok" in the response body.
#
# Prerequisites:
#   - CF_API_TOKEN: API token with Zone:Read + Health Checks:Edit permissions
#   - CF_ZONE_ID: Zone ID for spike.land (available in CF dashboard overview)
#
# Usage:
#   CF_API_TOKEN=xxx CF_ZONE_ID=yyy bash infra/cloudflare-health-checks/setup.sh

set -euo pipefail

: "${CF_API_TOKEN:?Set CF_API_TOKEN}"
: "${CF_ZONE_ID:?Set CF_ZONE_ID}"

API="https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/healthchecks"

create_check() {
  local name="$1"
  local address="$2"
  local path="$3"
  local interval="${4:-60}"
  local retries="${5:-2}"

  echo "Creating health check: ${name} → ${address}${path} (${interval}s, ${retries} retries)"

  curl -s -X POST "${API}" \
    -H "Authorization: Bearer ${CF_API_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{
      \"name\": \"${name}\",
      \"type\": \"HTTP\",
      \"check_regions\": [\"WEU\", \"ENAM\"],
      \"interval\": ${interval},
      \"retries\": ${retries},
      \"timeout\": 10,
      \"http_config\": {
        \"method\": \"GET\",
        \"port\": 443,
        \"path\": \"${path}\",
        \"expected_body\": \"\\\"status\\\":\\\"ok\\\"\",
        \"expected_codes\": [\"200\"],
        \"follow_redirects\": false,
        \"allow_insecure\": false
      },
      \"address\": \"${address}\",
      \"description\": \"External health probe for ${name}\",
      \"suspended\": false
    }" | jq -r '.result.id // .errors'

  echo ""
}

echo "=== spike.land External Health Checks ==="
echo ""

create_check "spike-edge"       "spike.land"               "/health"            60  2
create_check "spike-edge-deep"  "spike.land"               "/api/health?deep=true" 300 3
create_check "transpile"        "js.spike.land"             "/health"            60  2
create_check "mcp-registry"     "mcp.spike.land"            "/health"            60  2
create_check "auth-mcp"         "auth-mcp.spike.land"       "/health"            60  2
create_check "image-studio"     "image-studio-mcp.spike.land" "/health"          60  2

echo "=== Done. Verify in CF Dashboard → Traffic → Health Checks ==="
