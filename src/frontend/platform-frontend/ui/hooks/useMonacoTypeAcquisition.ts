import { useEffect, useState, useRef } from "react";
import { getTypeCache, setTypeCache } from "../../core-logic/ata-cache";

interface UseMonacoTypeAcquisitionProps {
  monaco: typeof import("monaco-editor") | null;
  code: string;
  debounceMs?: number;
}

export function useMonacoTypeAcquisition({
  monaco,
  code,
  debounceMs = 2000,
}: UseMonacoTypeAcquisitionProps) {
  const [typesReady, setTypesReady] = useState(false);
  const ataRunnerRef = useRef<{ update: (code: string) => void } | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const libsRef = useRef<Map<string, string>>(new Map());
  const initialMountRef = useRef(true);

  useEffect(() => {
    // Support either monaco.typescript (our local package) or monaco.languages.typescript
    const typescript = monaco?.typescript || monaco?.languages?.typescript;
    if (!monaco || !typescript) return;

    let isActive = true;

    // Configure diagnostics so Monaco shows meaningful errors, not noise
    typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
      noSuggestionDiagnostics: true,
      diagnosticCodesToIgnore: [
        // "Cannot find module" — expected before ATA fetches types
        2307,
        // "Could not find declaration file for module"
        7016,
      ],
    });

    async function initializeAta() {
      try {
        const [{ setupTypeAcquisition }, tsMod] = await Promise.all([
          import("@typescript/ata"),
          import("typescript"),
        ]);

        if (!isActive) return;

        // ESM dynamic import returns { default: ts, ...namedExports }.
        // ATA expects the TypeScript namespace object, not the module wrapper.
        const ts = (tsMod as unknown as { default?: typeof import("typescript") }).default ?? tsMod;

        const ata = setupTypeAcquisition({
          projectName: "spike-app",
          typescript: ts,
          logger: console,
          delegate: {
            receivedFile: (fileContent, filePath) => {
              if (!isActive) return;
              if (libsRef.current.get(filePath) === fileContent) return;
              libsRef.current.set(filePath, fileContent);
              // Apply each type file to Monaco immediately so IntelliSense works
              // progressively instead of waiting for the entire batch to finish.
              typescript.typescriptDefaults.addExtraLib(fileContent, filePath);
            },
            started: () => {
              if (!isActive) return;
              setTypesReady(false);
            },
            progress: (_downloaded, _total) => {
              // Optional progress feedback
            },
            finished: (_files) => {
              if (!isActive) return;

              // Sync the full set — setExtraLibs replaces everything, ensuring
              // stale entries from previous runs are cleaned up.
              const extraLibs = Array.from(libsRef.current.entries()).map(
                ([filePath, content]) => ({ filePath, content }),
              );
              if (extraLibs.length > 0) {
                typescript.typescriptDefaults.setExtraLibs(extraLibs);
              }

              setTypesReady(true);
            },
          },
          fetcher: async (request: RequestInfo | URL, init?: RequestInit) => {
            const url = typeof request === "string" ? request : request.toString();
            try {
              const cached = await getTypeCache(url);
              if (cached) {
                return new Response(cached, {
                  headers: { "Content-Type": "application/javascript" },
                });
              }
              const res = await fetch(request, init);
              if (res.ok) {
                const text = await res.clone().text();
                await setTypeCache(url, text);
              }
              return res;
            } catch (err) {
              console.error("[ATA Fetch Error]", url, err);
              // Return an empty 404 response so ATA can continue processing
              // remaining types instead of aborting the whole pipeline.
              return new Response("", { status: 404 });
            }
          },
        });

        ataRunnerRef.current = {
          update: (currentCode: string) => {
            const codeWithImplicit = `
              import React from "react";
              import ReactDOM from "react-dom";
              import { jsx, jsxs, Fragment } from "react/jsx-runtime";
              ${currentCode}
            `;
            ata(codeWithImplicit);
          },
        };

        // Trigger initial ATA run
        if (initialMountRef.current && code) {
          ataRunnerRef.current.update(code);
          initialMountRef.current = false;
        }
      } catch (err) {
        console.error("Failed to initialize ATA:", err);
      }
    }

    initializeAta();

    return () => {
      isActive = false;
    };
  }, [monaco]); // Intentionally excludes `code` to avoid re-initializing ATA

  useEffect(() => {
    if (!ataRunnerRef.current) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      ataRunnerRef.current?.update(code);
    }, debounceMs);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [code, debounceMs]);

  return { typesReady };
}
