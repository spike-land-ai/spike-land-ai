import { copilotService } from "@/services/CopilotService";
import { languages, typescript } from "@/workers/monaco-editor.worker";
import { getCompilerOptions, getDiagnosticsOptions } from "./config";

let completionsRegistered = false;

/**
 * Register TypeScript and TSX languages with Monaco editor
 * This includes setting up proper syntax highlighting for JSX/TSX
 * with special handling for dot notation components like motion.div
 */
export function registerLanguages(): void {
  // Configure TypeScript language defaults
  typescript.typescriptDefaults.setCompilerOptions(getCompilerOptions());
  typescript.typescriptDefaults.setDiagnosticsOptions(getDiagnosticsOptions());

  // Set mode configuration for TypeScript
  typescript.typescriptDefaults.setModeConfiguration({
    completionItems: true,
    hovers: true,
    documentSymbols: true,
    references: true,
    diagnostics: true,
    documentHighlights: true,
    documentRangeFormattingEdits: true,
  });

  if (!completionsRegistered) {
    completionsRegistered = true;

    // Store the active timeout and abort controller to clean them up on new keystrokes
    let activeTimeout: ReturnType<typeof setTimeout> | null = null;
    let activeAbortController: AbortController | null = null;

    const completionProvider: Parameters<typeof languages.registerInlineCompletionsProvider>[1] = {
      provideInlineCompletions: async (model, position, _context, token) => {
        // Skip if copilot is disabled or already cancelled
        if (!copilotService.isEnabled()) return { items: [] };
        if (token.isCancellationRequested) return { items: [] };

        // Clean up previous debounced request if it's still pending
        if (activeTimeout) {
          clearTimeout(activeTimeout);
          activeTimeout = null;
        }

        // Clean up previous fetch if it's still running
        if (activeAbortController) {
          activeAbortController.abort();
          activeAbortController = null;
        }

        const textUntilPosition = model.getValueInRange({
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column
        });
        const textAfterPosition = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: position.column,
          endLineNumber: model.getLineCount(),
          endColumn: model.getLineMaxColumn(model.getLineCount())
        });

        return new Promise((resolve) => {
          // Setup cancellation listener for this specific request
          const disposable = token.onCancellationRequested(() => {
            if (activeTimeout) {
              clearTimeout(activeTimeout);
              activeTimeout = null;
            }
            if (activeAbortController) {
              activeAbortController.abort();
              activeAbortController = null;
            }
            disposable.dispose();
            resolve({ items: [] });
          });

          // Debounce for 400ms before firing the request
          activeTimeout = setTimeout(async () => {
            if (token.isCancellationRequested) {
              resolve({ items: [] });
              return;
            }

            activeAbortController = new AbortController();

            try {
              const completion = await copilotService.requestCompletion(
                textUntilPosition,
                textAfterPosition,
                activeAbortController.signal,
              );

              if (token.isCancellationRequested || !completion) {
                resolve({ items: [] });
                return;
              }

              resolve({
                items: [{
                  insertText: completion,
                  range: {
                    startLineNumber: position.lineNumber,
                    startColumn: position.column,
                    endLineNumber: position.lineNumber,
                    endColumn: position.column
                  }
                }]
              });
              return;
            } catch (err: unknown) {
              if (err instanceof Error && err.name !== "AbortError") {
                console.error("Failed to get inline completion:", err);
              }
            } finally {
              disposable.dispose();
            }

            resolve({ items: [] });
          }, 400);
        });
      },
      disposeInlineCompletions: () => {},
    };

    for (const lang of ["typescript", "javascript", "css", "html", "json"]) {
      languages.registerInlineCompletionsProvider(lang, completionProvider);
    }
  }

  // Configure language features for TypeScript/TSX
  languages.onLanguage("typescript", () => {
    languages.setLanguageConfiguration("typescript", {
      // This pattern supports component names with dot notation like motion.div
      wordPattern: /(-?\d*\.\d\w*)|([a-zA-Z_$][\w$]*(?:\.[\w$]+)*)/g,
      comments: {
        lineComment: "//",
        blockComment: ["/*", "*/"],
      },
      brackets: [
        ["{", "}"],
        ["[", "]"],
        ["(", ")"],
      ],
      autoClosingPairs: [
        { open: "{", close: "}" },
        { open: "[", close: "]" },
        { open: "(", close: ")" },
        { open: '"', close: '"' },
        { open: "'", close: "'" },
        { open: "`", close: "`" },
        { open: "/**", close: " */" },
      ],
      surroundingPairs: [
        { open: "{", close: "}" },
        { open: "[", close: "]" },
        { open: "(", close: ")" },
        { open: '"', close: '"' },
        { open: "'", close: "'" },
        { open: "`", close: "`" },
      ],
      folding: {
        markers: {
          start: /^\s*\/\/\s*#?region\b/,
          end: /^\s*\/\/\s*#?endregion\b/,
        },
      },
      indentationRules: {
        increaseIndentPattern: /^((?!\/\/).)*(\{[^}"'`]*|\([^)"'`]*|\[[^\]"'`]*)$/,
        decreaseIndentPattern: /^\s*(}|\)|\])$/,
      },
    });
  });
}

/**
 * Configure TypeScript for JSX/TSX syntax highlighting
 * @param uri The URI of the file
 */
export function configureJsxSupport(uri: string): void {
  // If this is a TSX file, ensure JSX syntax highlighting is enabled
  if (uri.endsWith(".tsx")) {
    // Register JSX tokens provider if needed
    typescript.typescriptDefaults.setCompilerOptions({
      ...typescript.typescriptDefaults.getCompilerOptions(),
      jsx: typescript.JsxEmit.ReactJSX,
      jsxFactory: "React.createElement",
      jsxFragmentFactory: "React.Fragment",
      jsxImportSource: "@emotion/react",
    });
  }
}
