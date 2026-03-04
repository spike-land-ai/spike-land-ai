const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/spike-land-mcp/mcp/manifest.ts');
const content = fs.readFileSync(filePath, 'utf8');

// Extract TOOL_MODULES
const match = content.match(/const TOOL_MODULES:\s*Array<\[string,\s*string\]>\s*=\s*\[([\s\S]*?)\];/);
if (!match) {
  console.error('Could not find TOOL_MODULES');
  process.exit(1);
}

const arrayContent = match[1];
const lines = arrayContent.split('\n');

const imports = [];
const calls = [];

for (const line of lines) {
  // match ["../tools/X", "registerXTools"]
  const m = line.match(/\[\s*"([^"]+)",\s*"([^"]+)"\s*\]/);
  if (m) {
    const modulePath = m[1];
    const fnName = m[2];
    imports.push(`import { ${fnName} } from "${modulePath}";`);
    calls.push(`  try { ${fnName}(registry, userId, db, env?.kv, env?.vaultSecret); } catch (err) { console.error("[MCP] Failed to register ${fnName}:", err); }`);
  }
}

const newContent = `/**
 * Tool Registration Manifest
 *
 * Complete manifest of all tool modules for spike-land-mcp.
 * Each module is statically imported to ensure optimal bundling
 * via esbuild for Cloudflare Workers.
 */

import type { ToolRegistry } from "./registry";
import type { DrizzleDB } from "../db/index";

export interface ToolRegistrationEnv {
  kv?: KVNamespace;
  vaultSecret?: string;
}

// ─── Static Imports ───
${imports.join('\n')}

/**
 * Register all tool modules.
 */
export async function registerAllTools(
  registry: ToolRegistry,
  userId: string,
  db: DrizzleDB,
  env?: ToolRegistrationEnv,
): Promise<void> {
${calls.join('\n')}
}
`;

fs.writeFileSync(filePath, newContent, 'utf8');
console.log('Successfully transformed manifest.ts');
