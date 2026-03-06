// src/importMapUtils.ts

export interface ImportMap {
  imports: Record<string, string>;
}

// Configuration Constants
const FILE_EXTENSIONS = new Set([
  ".js",
  ".mjs",
  ".ts",
  ".tsx",
  ".jsx",
  ".json",
  ".wasm",
  ".txt",
  ".svg",
  ".md",
  ".html",
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".styl",
  ".graphql",
  ".gql",
  ".yml",
  ".toml",
  ".xml",
  ".csv",
  ".tsv",
  ".ini",
  ".properties",
  ".env",
  ".env.local",
  ".env.development",
  ".env.test",
  ".env.production",
  ".env.staging",
]);

const WORKER_PATTERNS = ["/workers/", ".worker"];
const COMPONENT_PATTERNS = [
  "@/components/",
  "@/services/",
  "@/utils/",
  "@/tools/",
  "/live/",
  "@/lib",
  "@/external",
  "@/hooks",
];

const MAX_EXPORTS_PER_URL = 8;

export const ESM_CDN = "https://esm.spike.land";

export const REACT_VERSION = "19.2.4";
export const DEPS_PARAM = `deps=react@${REACT_VERSION},react-dom@${REACT_VERSION},react-is@${REACT_VERSION}`;

export const EXTERNAL_DEPENDENCIES = [
  "react",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "react-dom",
  "react-dom/client",
  "react-dom/server",
  "framer-motion",
  "@emotion/react",
  "@emotion/react/jsx-runtime",
  "@emotion/react/jsx-dev-runtime",
  "@emotion/styled",
  "recharts",
  "@dnd-kit/core",
  "@dnd-kit/sortable",
  "@dnd-kit/utilities",
  "react-is",
];

// Default Import Map
export const importMap: ImportMap = {
  imports: {
    "/@/": "/@/",
    "@emotion/react/jsx-runtime": "/emotionJsxRuntime.mjs",
    "@emotion/react/jsx-dev-runtime": "/emotionJsxRuntime.mjs",
    "@emotion/styled": "/emotionStyled.mjs",
    "react/jsx-runtime": "/jsx.mjs",
    "react-dom/server": "/reactDomServer.mjs",
    "react-dom/client": "/reactDomClient.mjs",
    "@emotion/react": "/emotion.mjs",
    react: "/reactMod.mjs",
    "react-dom": "/reactDom.mjs",
    recharts: "/recharts.mjs",
    "framer-motion": "/framerMotion.mjs",
    "@dnd-kit/core": `${ESM_CDN}/@dnd-kit/core?bundle=true&external=${EXTERNAL_DEPENDENCIES.join(",")}&${DEPS_PARAM}`,
    "@dnd-kit/sortable": `${ESM_CDN}/@dnd-kit/sortable?bundle=true&external=${EXTERNAL_DEPENDENCIES.join(",")}&${DEPS_PARAM}`,
    "@dnd-kit/utilities": `${ESM_CDN}/@dnd-kit/utilities?bundle=true&external=${EXTERNAL_DEPENDENCIES.join(",")}&${DEPS_PARAM}`,
    "react-is": `${ESM_CDN}/react-is@${REACT_VERSION}?bundle=true&external=${EXTERNAL_DEPENDENCIES.join(",")}&${DEPS_PARAM}`,
    "https://esm.spike.land/react-is/": `${ESM_CDN}/react-is@${REACT_VERSION}/`,
  },
};

// Utility Functions
function hasKnownExtension(path: string): boolean {
  const lastDotIndex = path.lastIndexOf(".");
  return lastDotIndex !== -1 && FILE_EXTENSIONS.has(path.slice(lastDotIndex));
}

function isWorkerFile(path: string): boolean {
  return WORKER_PATTERNS.some((pattern) => path.includes(pattern));
}

function isComponentFile(path: string): boolean {
  return COMPONENT_PATTERNS.some((pattern) => path.includes(pattern));
}

function processQueryAndHash(path: string): {
  basePath: string;
  query: string;
  hash: string;
} {
  const [pathPart, hash] = path.split("#");
  const [basePath, query] = (pathPart || "").split("?");

  return {
    basePath: basePath || "",
    query: query ? `?${query}` : "",
    hash: hash ? `#${hash}` : "",
  };
}

function shouldTransformPath(path: string): boolean {
  return (
    !path.includes("?bundle=true") &&
    !path.startsWith("data:") &&
    !path.startsWith("http://") &&
    !path.startsWith("https://") &&
    !path.startsWith("/live/")
  );
}

function getExportsString(match: string): string {
  const namedImports = match.match(/\{([^}]*)\}/s)?.[1];
  return (
    namedImports
      ?.split(",")
      .map((s) => s.trim().split(" as ")[0])
      .filter(Boolean)
      .join(",") || ""
  );
}

function sortExports(param: string): string {
  return param.split(",").filter(Boolean).sort().join(",");
}

function parseNamedExports(match: string): Array<{ name: string; alias?: string }> {
  const namedImports = match.match(/\{([^}]*)\}/s)?.[1];
  if (!namedImports) return [];
  return namedImports
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const parts = s.split(/\s+as\s+/);
      return parts.length > 1 ? { name: parts[0]!, alias: parts[1]! } : { name: parts[0]! };
    });
}

function splitLargeImport(
  match: string,
  importPath: string,
  keyword: "import" | "export",
  importMapImports: ImportMap["imports"] = importMap.imports,
): string | null {
  const exports = parseNamedExports(match);
  if (exports.length <= MAX_EXPORTS_PER_URL) return null;

  // Detect default import (only for import statements)
  let defaultImport: string | undefined;
  if (keyword === "import") {
    const defaultMatch = match.match(/import\s+([A-Za-z_$][\w$]*)\s*,\s*\{/);
    if (defaultMatch) defaultImport = defaultMatch[1];
  }

  // Detect indentation from the original match
  const indentMatch = match.match(/^(\s*)/);
  const indent = indentMatch ? indentMatch[1] : "";

  const chunks: Array<{ name: string; alias?: string }>[] = [];
  for (let i = 0; i < exports.length; i += MAX_EXPORTS_PER_URL) {
    chunks.push(exports.slice(i, i + MAX_EXPORTS_PER_URL));
  }

  return chunks
    .map((chunk, idx) => {
      const specifiers = chunk
        .map((e) => (e.alias ? `${e.name} as ${e.alias}` : e.name))
        .join(", ");
      const exportsParam = sortExports(chunk.map((e) => e.name).join(","));
      const mappedPath = getMappedPath(importPath, exportsParam, true, importMapImports);

      if (keyword === "export") {
        return `${indent}export { ${specifiers} } from "${mappedPath}";`;
      }

      // First chunk gets default import if present
      if (idx === 0 && defaultImport) {
        return `${indent}import ${defaultImport}, { ${specifiers} } from "${mappedPath}";`;
      }
      return `${indent}import { ${specifiers} } from "${mappedPath}";`;
    })
    .join("\n");
}

function getMappedPath(
  path: string,
  exportsParam = "",
  hasFromClause = false,
  importMapImports: ImportMap["imports"] = importMap.imports,
): string {
  const { basePath, query, hash } = processQueryAndHash(path);

  // Early returns for complex or special paths
  if (path.includes("${") || path.includes("+")) return path;

  // Exact match in import map
  if (importMapImports[basePath]) return path;

  // Check for prefix matches in import map (e.g., @/components/ui/)
  for (const [prefix, mappedPrefix] of Object.entries(importMapImports)) {
    if (basePath.startsWith(prefix) && prefix.endsWith("/")) {
      const restPath = basePath.slice(prefix.length);
      return mappedPrefix + restPath + query + hash;
    }
  }

  // Handle worker files
  if (isWorkerFile(basePath)) {
    const baseWithoutExt = hasKnownExtension(basePath)
      ? basePath.substring(0, basePath.lastIndexOf("."))
      : basePath;
    const extension = hasFromClause ? ".mjs" : ".js";
    const resultPath = baseWithoutExt + extension;

    return !resultPath.startsWith(".") && !resultPath.startsWith("/")
      ? `/${resultPath}`
      : resultPath;
  }

  // Handle component and special files
  if (isComponentFile(basePath)) {
    const baseWithoutExt = hasKnownExtension(basePath)
      ? basePath.substring(0, basePath.lastIndexOf("."))
      : basePath;
    const extension = ".mjs";
    const resultPath = baseWithoutExt + extension;

    return !resultPath.startsWith(".") && !resultPath.startsWith("/")
      ? `/${resultPath}`
      : resultPath;
  }

  // Handle directory imports and paths without extension
  if (!hasKnownExtension(basePath) && (basePath.startsWith(".") || basePath.startsWith("/"))) {
    const extension = basePath.endsWith("/") ? "index.mjs" : ".mjs";
    return `${basePath}${extension}${query}${hash}`;
  }

  // Preserve live and absolute URLs
  if (basePath.startsWith("/live/") || /^https?:\/\//.test(basePath)) {
    return path;
  }

  // Handle non-relative paths — resolve directly to ESM CDN
  if (!basePath.startsWith(".") && !basePath.startsWith("/")) {
    const params = ["bundle=true", `external=${EXTERNAL_DEPENDENCIES.join(",")}`, DEPS_PARAM];

    if (exportsParam) params.push(`exports=${sortExports(exportsParam)}`);

    return `${ESM_CDN}/${basePath}?${params.join("&")}${query}${hash}`;
  }

  return `${basePath}${query}${hash}`;
}

export function importMapReplace(code: string): string {
  // Prevent double processing
  if (code.includes("/** importMapReplace */") || code.includes("/* esm.sh")) {
    return code;
  }

  // Normalize line endings
  code = code.replace(/\r\n/g, "\n");

  // Helper function for replacing imports
  const replaceImport = (match: string, pre: string, q1: string, path: string, q2: string) => {
    if (!shouldTransformPath(path)) return match;
    const fullPath = getMappedPath(path, "", false);
    return `${pre}${q1}${fullPath}${q2}`;
  };

  // Replace simple imports
  code = code.replace(/^(\s*import\s+)(['"])([^'"]+)(['"];\s*$)/gm, replaceImport);

  // Replace imports with from clause
  code = code.replace(/^(\s*import\s+[\s\S]*?from\s+['"])([^'"]+)(['"];?)/gm, (match) => {
    if (match.includes("/** importMapReplace */")) return match;

    const pathMatch = match.match(/['"]([^'"]+)['"]/);
    if (!pathMatch) return match;

    const importPath = pathMatch[1];
    if (!importPath || !shouldTransformPath(importPath)) return match;

    // Try splitting large imports
    const split = splitLargeImport(match, importPath, "import");
    if (split) return split;

    const exportsParam = getExportsString(match);
    const mappedPath = getMappedPath(importPath!, exportsParam, true);
    return match.replace(/['"][^'"]+['"]/, `"${mappedPath}"`);
  });

  // Replace export from clauses
  code = code.replace(/^(\s*export\s+[\s\S]*?from\s+['"])([^'"]+)(['"];?)/gm, (match) => {
    if (match.includes("/** importMapReplace */")) return match;

    const pathMatch = match.match(/['"]([^'"]+)['"]/);
    if (!pathMatch) return match;

    const exportPath = pathMatch[1];
    if (!exportPath || !shouldTransformPath(exportPath)) return match;

    // Try splitting large exports
    const split = splitLargeImport(match, exportPath, "export");
    if (split) return split;

    const exportsParam = getExportsString(match);
    const mappedPath = getMappedPath(exportPath!, exportsParam, true);
    return match.replace(/['"][^'"]+['"]/, `"${mappedPath}"`);
  });

  // Replace dynamic imports
  code = code.replace(/(\bimport\s*\(\s*['"])([^'"]+)(['"]\s*\))/g, (match) => {
    const pathMatch = match.match(/['"]([^'"]+)['"]/);
    if (!pathMatch) return match;

    const importPath = pathMatch[1];
    if (!importPath || !shouldTransformPath(importPath)) return match;

    const mappedPath = getMappedPath(importPath!, "", true);
    return match.replace(/['"][^'"]+['"]/, `"${mappedPath}"`);
  });

  return `/** importMapReplace */\n${code}`;
}

export default importMap;
