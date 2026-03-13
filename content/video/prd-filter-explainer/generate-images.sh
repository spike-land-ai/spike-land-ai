#!/usr/bin/env bash
# Generate all 16 support photos for the PRD Filter explainer video
# Uses the spike.land edge API gateway (OpenAI-compatible endpoint)
# or the image-studio MCP server directly.
#
# Usage:
#   ./generate-images.sh          # via edge API
#   ./generate-images.sh --mcp    # via mcp-cli (if configured)

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/images"
PROMPTS_FILE="$SCRIPT_DIR/prompts.json"

mkdir -p "$OUTPUT_DIR"

echo "=== PRD Filter Explainer — Image Generator ==="
echo "Output: $OUTPUT_DIR"
echo ""

# Read prompts and generate via mcp-cli if available
if command -v mcp-cli &>/dev/null && [[ "${1:-}" == "--mcp" ]]; then
  echo "Using mcp-cli image-studio..."
  count=$(python3 -c "import json; print(len(json.load(open('$PROMPTS_FILE'))))")
  for i in $(seq 0 $((count - 1))); do
    prompt_json=$(python3 -c "
import json
prompts = json.load(open('$PROMPTS_FILE'))
p = prompts[$i]
print(json.dumps({
  'prompt': p['prompt'],
  'negative_prompt': p['negative_prompt'],
  'aspect_ratio': p['aspect_ratio'],
  'tier': p['tier'],
  'seed': p['seed']
}))
")
    filename=$(python3 -c "import json; print(json.load(open('$PROMPTS_FILE'))[$i]['filename'])")
    echo "[$((i+1))/16] Generating $filename..."
    mcp-cli image-studio/img_generate "$prompt_json" --json > "$OUTPUT_DIR/${filename%.png}.json" 2>&1 || echo "  WARN: generation may have failed"
  done
else
  echo "mcp-cli not available or --mcp not specified."
  echo ""
  echo "To generate images, use one of these approaches:"
  echo ""
  echo "1. Via Claude Code with image-studio MCP configured:"
  echo "   claude mcp add image-studio node packages/mcp-image-studio/dist/cli-server.js"
  echo "   Then ask Claude to generate using the prompts in prompts.json"
  echo ""
  echo "2. Via the spike.land API gateway:"
  echo "   curl -X POST https://edge.spike.land/v1/chat/completions \\"
  echo "     -H 'Authorization: Bearer YOUR_TOKEN' \\"
  echo "     -H 'Content-Type: application/json' \\"
  echo "     -d '{\"model\": \"spike-agent-v1\", \"messages\": [{\"role\": \"user\", \"content\": \"Generate image: <prompt>\"}]}'"
  echo ""
  echo "3. Manually with any image generation tool using prompts.json"
  echo ""
  echo "Prompts file: $PROMPTS_FILE"
fi

echo ""
echo "Done. Script: $SCRIPT_DIR/script.md"
