import { getAtaCache, setAtaCache } from "@/lib/idb-cache";
import { QueuedFetch } from "@/lib/queued-fetch";
import { tryCatch } from "@/lib/try-catch";
import { setupTypeAcquisition } from "@typescript/ata";
import ts from "typescript";

// Keep the globalThis reference style for shared worker compatibility

interface ExtraLib {
  filePath: string;
  content: string;
}

// Consolidated path cleaning logic
export function cleanFilePath(filePath: string, originToUse: string): string {
  // Remove potential origins and CDN prefixes
  let cleaned = filePath
    .replace(originToUse, "")
    .replace("https://spike.land", "")
    .replace("https://esm.sh", "");

  // Remove node_modules, @types, version paths (e.g., /v18/)
  cleaned = cleaned
    .replace(/\/node_modules\//g, "/")
    .replace(/@types\//g, "")
    .replace(/dist\//g, "")
    .replace(/types\//g, "")
    .replace(/src\//g, "")
    .replace(/declarations\//g, "")
    .replace(/\/v\d+\//g, "/");
  // Remove specific TS version paths if they appear
  cleaned = cleaned.replace(/ts\d+\.\d+\//g, "");

  // Remove version numbers like @1.2.3
  cleaned = cleaned.replace(/@(\^)?\d+(\.)?\d+(\.)?\d+/g, "");

  // Normalize paths starting with /
  if (!cleaned.startsWith("/")) {
    cleaned = `/${cleaned}`;
  }

  // Remove any double slashes that might have been introduced
  cleaned = cleaned.replace(/\/\//g, "/");

  // Ensure it doesn't end with .d.ts/ - this shouldn't happen with ATA VFS keys but good practice
  cleaned = cleaned.replace(/\.d\.ts\//g, "/");

  return cleaned;
}

// Consolidated content cleaning logic
export function cleanFileContent(content: string, originToUse: string): string {
  // Perform similar cleaning on content, focusing on import/reference paths
  let cleaned = content
    .replace(new RegExp(originToUse, "g"), "")
    .replace(/https:\/\/spike\.land/g, "")
    .replace(/https:\/\/esm\.sh/g, "");

  // Clean paths within the content
  cleaned = cleaned
    .replace(/\/node_modules\//g, "/")
    .replace(/@types\//g, "")
    .replace(/dist\//g, "")
    .replace(/types\//g, "")
    .replace(/src\//g, "")
    .replace(/declarations\//g, "");

  // Remove version numbers like @1.2.3
  cleaned = cleaned.replace(/@(\^)?\d+(\.)?\d+(\.)?\d+/g, "");

  // Remove specific TS version paths if they appear
  cleaned = cleaned.replace(/ts\d+\.\d+\//g, "");

  // Fix potentially broken import paths if origin was stripped
  cleaned = cleaned.replace(/from "\//g, 'from "').replace(/path="\//g, 'path="');

  // Ensure it doesn't end with .d.ts/
  cleaned = cleaned.replace(/\.d\.ts\//g, "/");

  return cleaned;
}

// Helper to extract import specifiers from code
export function extractImportSpecifiers(code: string): string[] {
  const sourceFile = ts.createSourceFile(
    "temp.tsx", // Temporary filename, doesn't matter
    code,
    ts.ScriptTarget.Latest,
    true, // setParentNodes
    ts.ScriptKind.TSX, // Assume TSX for flexibility
  );

  const imports: string[] = [];

  function visit(node: ts.Node) {
    // Check for import declarations: import ... from "specifier";
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push(node.moduleSpecifier.text);
    } // Check for dynamic imports: import("specifier")
    else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const arg = node.arguments[0];
      if (arg && ts.isStringLiteral(arg)) {
        imports.push(arg.text);
      }
    } // Check for require calls: require("specifier") - less common in ESM workers but good to have
    else if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "require"
    ) {
      const arg = node.arguments[0];
      if (arg && ts.isStringLiteral(arg)) {
        imports.push(arg.text);
      }
    }
    // Triple-slash directives are handled via comment parsing below

    ts.forEachChild(node, visit);
  }

  // Also check for triple-slash references in comments
  ts.forEachLeadingCommentRange(sourceFile.text, sourceFile.getFullStart(), (pos, end, kind) => {
    if (
      kind === ts.SyntaxKind.MultiLineCommentTrivia ||
      kind === ts.SyntaxKind.SingleLineCommentTrivia
    ) {
      const commentText = sourceFile.text.substring(pos, end);
      const match = commentText.match(/<reference\s+path=["']([^"']+)["']\s*\/>/);
      if (match && match[1]!) {
        imports.push(match[1]!);
      }
    }
  });

  visit(sourceFile);
  return [...new Set(imports)]; // Return unique specifiers
}

// Main refactored ATA function
export async function ata({
  code,
  originToUse,
}: {
  code: string;
  originToUse: string;
}): Promise<ExtraLib[]> {
  const queuedFetch = new QueuedFetch(4, 10000, 100); // Keep adjusted settings

  // Wrap fetch with IDB cache for type definition responses
  const cachedFetch: typeof fetch = async (input, init?) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const cached = await getAtaCache(url);
    if (cached !== null) {
      return new Response(cached, { status: 200, headers: { "x-idb-cache": "hit" } });
    }
    const fetchInput = input instanceof URL ? input.toString() : input;
    const response = await queuedFetch.fetch(fetchInput, init);
    if (response.ok) {
      const text = await response.text();
      await setAtaCache(url, text);
      return new Response(text, { status: response.status, headers: response.headers });
    }
    return response;
  };

  // 1. Extract imports from the original code first
  const extCode = `${code}
import "react";
import "@emotion/react";
import * as JSXruntime from "@emotion/react/jsx-runtime";
import "react/jsx-runtime";
import "react/jsx-dev-runtime";
import "react/jsx-runtime/jsx-dev-runtime";
import "react/jsx-runtime/jsx-dev-runtime.d.ts";
import "react/jsx-dev-runtime/jsx-dev-runtime.d.ts";
import "react/jsx-dev-runtime/jsx-dev-runtime";
import "react/jsx-dev-runtime/jsx-dev-runtime.d.ts";
// Add other common implicit dependencies if necessary
`;
  const importSpecifiers = extractImportSpecifiers(extCode);

  // 2. Run ATA
  const { data: vfs, error: vfsError } = await tryCatch(
    new Promise<Map<string, string>>((resolve) =>
      setupTypeAcquisition({
        projectName: "MonacoEditorTypes",
        typescript: ts,
        logger: console, // Keep console for ATA's internal logger, or create a more complex adapter
        fetcher: cachedFetch as typeof fetch,
        delegate: {
          started: () => {},
          progress: () => {},
          receivedFile: () => {},
          errorMessage: (userFacingMessage, error) =>
            console.error(`[ATA] Error: ${userFacingMessage}`, error),
          finished: (vfsMap) => {
            resolve(vfsMap);
          },
        },
      })(extCode),
    ),
  );

  if (vfsError) {
    console.error("[ATA] Failed to acquire types:", vfsError);
    return [];
  }

  // 3. Process ATA VFS
  const processedLibs: Record<string, string> = {};
  for (const [filePath, content] of vfs.entries()) {
    const cleanedPath = cleanFilePath(filePath, originToUse);
    const cleanedContent = cleanFileContent(content, originToUse);
    if (!processedLibs[cleanedPath]) {
      processedLibs[cleanedPath] = cleanedContent;
    }
  }

  // 4. Identify & Fetch Missing Aliased Imports and /live/ Imports
  const aliasPrefix = "@/";
  const livePrefix = "/live/";
  const extraFetchPromises: Array<Promise<void>> = [];

  for (const specifier of importSpecifiers) {
    if (specifier.startsWith(aliasPrefix)) {
      const mappedPath = specifier;
      // Construct the expected final path *after* cleaning
      const expectedCleanedPath = cleanFilePath(`/${mappedPath}.d.ts`, originToUse); // Assume .d.ts extension

      if (!processedLibs[expectedCleanedPath]) {
        const fetchUrl = `${originToUse}/${mappedPath}.d.ts`;

        extraFetchPromises.push(
          cachedFetch(fetchUrl)
            .then(async (response) => {
              if (response.ok) {
                const content = await response.text();
                const finalFilePath = cleanFilePath(fetchUrl, originToUse);
                const cleanedContent = cleanFileContent(content, originToUse);

                if (!processedLibs[finalFilePath]) {
                  processedLibs[finalFilePath] = cleanedContent;
                }
              }
            })
            .catch((error) => {
              console.error(
                `[ATA] Error fetching aliased import ${specifier} from ${fetchUrl}:`,
                error,
              );
            }),
        );
      }
    }

    // Handle /live/ cross-codespace imports
    if (specifier.startsWith(livePrefix)) {
      const codeSpaceName = specifier.slice(livePrefix.length).split("/")[0];
      if (!codeSpaceName) continue;

      const fetchUrl = `${originToUse}/live/${codeSpaceName}/index.tsx`;
      const dtsPath = `/live/${codeSpaceName}.d.ts`;
      const barePath = `/live/${codeSpaceName}`;

      if (!processedLibs[dtsPath]) {
        extraFetchPromises.push(
          cachedFetch(fetchUrl)
            .then(async (response) => {
              if (response.ok) {
                const content = await response.text();
                if (!processedLibs[dtsPath]) {
                  processedLibs[dtsPath] = content;
                }
                if (!processedLibs[barePath]) {
                  processedLibs[barePath] = content;
                }
              }
            })
            .catch((error) => {
              console.error(`[ATA] Error fetching /live/ import ${specifier}:`, error);
            }),
        );
      }
    }
  }

  // Wait for all extra fetches to complete
  const { error: extraFetchError } = await tryCatch(Promise.all(extraFetchPromises));
  if (extraFetchError) {
    console.error("[ATA] Error during extra fetches:", extraFetchError);
  }

  // 5. Finalize
  const extraLibs: ExtraLib[] = Object.entries(processedLibs)
    .map(([filePath, content]) => ({ filePath, content }))
    .sort((a, b) => a.filePath.localeCompare(b.filePath));

  // Optimized package.json filtering
  const filePaths = new Set(extraLibs.map((lib) => lib.filePath));
  const filteredLibs = extraLibs.filter((lib) => {
    if (lib.filePath.endsWith("/package.json")) {
      const indexDts = lib.filePath.replace("/package.json", "/index.d.ts");
      return !filePaths.has(indexDts);
    }
    if (lib.filePath.endsWith(".mts")) {
      const mts = lib.filePath.replace(".mts", ".d.ts").replace(".d.d", ".d");
      return !filePaths.has(mts);
    }
    return true;
  });

  return filteredLibs;
}

// Assign to self for SharedWorker context
Object.assign(self, { ata });
