/**
 * Tool Manifest — Auto-Discovery via Convention
 *
 * Derives the tool manifest from schemas.json keys using naming conventions:
 *   File:      album-create.ts
 *   Tool name: img_album_create
 *   Interface: AlbumCreateInput
 *   Function:  albumCreate
 *
 * This replaces the manual 42-entry tuple array in register.ts.
 */

import schemasJson from "../generated/schemas.json" with { type: "json" };

export interface ToolManifestEntry {
  /** MCP tool name, e.g. "img_album_create" */
  toolName: string;
  /** Kebab-case file name without extension, e.g. "album-create" */
  fileName: string;
  /** PascalCase interface name, e.g. "AlbumCreateInput" */
  interfaceName: string;
  /** camelCase function name, e.g. "albumCreate" */
  functionName: string;
}

function toolNameToFileName(toolName: string): string {
  // "img_album_create" → "album-create"
  return toolName.replace(/^img_/, "").replace(/_/g, "-");
}

function toolNameToInterfaceName(toolName: string): string {
  // "img_album_create" → "AlbumCreateInput"
  return (
    toolName
      .replace(/^img_/, "")
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("") + "Input"
  );
}

function toolNameToFunctionName(toolName: string): string {
  // "img_album_create" → "albumCreate"
  const parts = toolName.replace(/^img_/, "").split("_");
  return parts
    .map((part, i) => (i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join("");
}

/**
 * Auto-generated manifest from schemas.json.
 * Each entry corresponds to one tool file in src/tools/.
 */
export const TOOL_MANIFEST: ToolManifestEntry[] = Object.keys(
  schemasJson as Record<string, unknown>,
).map((toolName) => ({
  toolName,
  fileName: toolNameToFileName(toolName),
  interfaceName: toolNameToInterfaceName(toolName),
  functionName: toolNameToFunctionName(toolName),
}));

const toolManifestMap = new Map<string, ToolManifestEntry>(
  TOOL_MANIFEST.map((entry) => [entry.toolName, entry]),
);

/** Lookup a manifest entry by tool name */
export function getManifestEntry(toolName: string): ToolManifestEntry | undefined {
  return toolManifestMap.get(toolName);
}
