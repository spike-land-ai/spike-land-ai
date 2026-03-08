import fs from "node:fs";
import path from "node:path";

const mapping = {
  "bazdmeg-mcp": "mcp-tools/bazdmeg",
  "block-sdk": "core/block-sdk",
  "block-tasks": "core/block-tasks",
  "block-website": "core/block-website",
  "chess-engine": "core/chess",
  "code": "frontend/monaco-editor",
  "esbuild-wasm-mcp": "mcp-tools/esbuild-wasm",
  "google-analytics-mcp": "mcp-tools/google-analytics",
  "google-ads-mcp": "mcp-tools/google-ads",
  "hackernews-mcp": "mcp-tools/hackernews",
  "image-studio-worker": "edge-api/image-studio-worker",
  "mcp-auth": "edge-api/auth",
  "mcp-image-studio": "mcp-tools/image-studio",
  "mcp-server-base": "core/server-base",
  "openclaw-mcp": "mcp-tools/openclaw",
  "qa-studio": "core/browser-automation",
  "react-ts-worker": "core/react-engine",
  "shared": "core/shared-utils",
  "spike-app": "frontend/platform-frontend",
  "spike-cli": "cli/spike-cli",
  "spike-edge": "edge-api/main",
  "spike-land-backend": "edge-api/backend",
  "spike-land-mcp": "edge-api/spike-land",
  "spike-review": "mcp-tools/code-review",
  "stripe-analytics-mcp": "mcp-tools/stripe-analytics",
  "state-machine": "core/statecharts",
  "transpile": "edge-api/transpile",
  "vibe-dev": "cli/docker-dev",
  "video": "media/educational-videos",
  "whatsapp-mcp": "utilities/whatsapp",
};

const testsDir = path.resolve(".tests");

function walk(dir: string, callback: (file: string) => void) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stats = fs.statSync(filePath);
    if (stats.isDirectory()) {
      walk(filePath, callback);
    } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
      callback(filePath);
    }
  }
}

walk(testsDir, (filePath) => {
  let content = fs.readFileSync(filePath, "utf8");
  let changed = false;

  for (const [pkg, mapped] of Object.entries(mapping)) {
    // Matches something like: "../../src/bazdmeg-mcp/" or "src/bazdmeg-mcp/"
    // We look for patterns like: /src/pkg/
    // We handle relative paths by looking for "src/pkg/" preceded by any number of "../" or "/"
    
    const regex = new RegExp(`(?<=(?:\\.\\.\\/|\\/|^)src\\/)${pkg}(?=[\\/\\'\\"])`, "g");
    if (regex.test(content)) {
      content = content.replace(regex, mapped);
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`Updated ${filePath}`);
  }
});
