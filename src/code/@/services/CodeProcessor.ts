import { importMap, importMapReplace } from "@/lib/importmap-utils";
import type { ICodeSession } from "@/lib/interfaces";
import { md5 } from "@/lib/md5";
import { tryCatch } from "@/lib/try-catch";
import { transpileCode } from "@/services/editorUtils";
import { RenderService } from "@/services/RenderService";
import type { RunMessageResult } from "@/services/types";

const RENDER_OPERATION_TIMEOUT_MS = 5000;
const OVERALL_PROCESS_TIMEOUT_MS = 10000;

/**
 * Message data structure for rendered content from the iframe.
 * Contains the HTML and CSS extracted after rendering the component.
 */
interface IframeRenderedMessageData {
  type: "rendered";
  requestId: string;
  iteration: number;
  data: {
    html: string;
    css: string;
  };
}

/**
 * Processed session data structure containing code and render output.
 */
interface ProcessedSession {
  code: string;
  transpiled: string;
  html?: string;
  css?: string;
}

/**
 * Type guard to check if message data is a valid rendered message from the iframe.
 * @param data - The message data to check
 * @param expectedRequestId - The expected request ID to match
 * @returns True if the data is a valid rendered message with matching request ID
 */
function isRenderedMessage(
  data: unknown,
  expectedRequestId: string,
): data is IframeRenderedMessageData {
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    (data as IframeRenderedMessageData).type === "rendered" &&
    "requestId" in data &&
    (data as IframeRenderedMessageData).requestId === expectedRequestId &&
    "data" in data &&
    typeof (data as IframeRenderedMessageData).data === "object"
  );
}

export class CodeProcessor {
  private static renderService: RenderService;

  constructor(codeSpace: string) {
    if (!CodeProcessor.renderService) {
      CodeProcessor.renderService = new RenderService(codeSpace);
    }
  }

  /**
   * Formats and transpiles the code (optionally runs it),
   * then returns updated session info or false on failure.
   */
  /**
   * Processes code: formats, transpiles, and (optionally) runs it.
   * If replaceIframe is provided, replaces the draggable window's iframe DOM node to show the rendered result.
   */
  async process(
    rawCode: string,
    skipRunning: boolean,
    signal: AbortSignal,
    getSession: () => ICodeSession,
    replaceIframe?: (newIframe: HTMLIFrameElement) => void,
  ): Promise<ICodeSession | false> {
    const origin = window.location.origin;
    if (signal.aborted) return false;

    // Transpile code
    const { data: transpiled, error: transpileError } = await tryCatch(this.transpileCode(rawCode));
    if (signal.aborted || transpileError) {
      if (transpileError) {
        console.error("Error transpiling code:", transpileError);
      }
      return false;
    }

    if (getSession().transpiled === transpiled) {
      return getSession();
    }

    const processedSession = {
      code: rawCode,
      transpiled,
    };

    if (!skipRunning) {
      // Call the helper method to handle iframe execution.
      // Pass processedSession so it can be updated with html and css.
      const executionSuccessful = await this._handleCodeExecutionInIframe(
        transpiled,
        origin,
        replaceIframe,
        processedSession,
        signal,
      );
      if (!executionSuccessful) {
        // If iframe execution failed, an error would have been logged by the helper.
        // Return false to indicate overall processing failure.
        return false;
      }
    }

    if (signal.aborted) {
      return false;
    }

    return {
      ...getSession(),
      ...processedSession,
    };
  }

  // This new private helper method encapsulates the logic for creating and managing
  // the iframe used for sandboxed code execution and rendering.
  /**
   * Handles code execution in a sandboxed iframe and extracts the rendered HTML/CSS.
   * @param transpiled - The transpiled JavaScript code to execute
   * @param origin - The origin URL for resolving imports
   * @param replaceIframe - Optional callback to replace the iframe DOM element
   * @param processedSession - Session data object that will be mutated with html and css
   * @param signal - AbortSignal to cancel the operation
   * @returns True on successful execution, false on failure
   */
  private async _handleCodeExecutionInIframe(
    transpiled: string,
    origin: string,
    replaceIframe: ((newIframe: HTMLIFrameElement) => void) | undefined,
    processedSession: ProcessedSession,
    signal?: AbortSignal,
  ): Promise<boolean> {
    // Generate a unique request ID for this render operation based on transpiled code hash
    const expectedRequestId = md5(transpiled);

    if (signal?.aborted) {
      return false;
    }

    try {
      // The cleanupPreviousRender was commented out. If uncommented,
      // its purpose is to ensure that any previous rendering iframe and its associated
      // message listener are removed before starting a new render. This prevents
      // multiple iframes from existing or old listeners from incorrectly processing messages.
      // this.cleanupPreviousRender();

      // Create a Blob URL for the transpiled JavaScript code.
      // This is necessary to import the code as a module in the sandboxed iframe.
      // The importMapReplace function ensures that import paths are correctly resolved
      // according to the project's import map.
      const { data: blobUrlForTranspiledCode, error: blobError } = await tryCatch(
        Promise.resolve(
          URL.createObjectURL(
            new Blob(
              [
                importMapReplace(transpiled.split("importMapReplace").join(""))
                  .split(`from "/`)
                  .join(`from "${origin}/`),
              ],
              { type: "application/javascript" },
            ),
          ),
        ),
      );

      if (blobError) {
        console.error("Error creating blob URL:", blobError);
        return false;
      }
      // Create an iframe which renders the transpiled code
      const iframeSource = `<!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta http-equiv="X-UA-Compatible" content="IE=edge">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            html,body,#embed {
              isolation: isolate;
              height: 100vh;
              height: 100dvh;
              height: 100svh;
              font-family: "Roboto Flex", sans-serif;
            }
            body { margin: 0; padding: 0; }
          </style>
          <style type="text/tailwindcss">
            @import "tailwindcss";
            @custom-variant dark (&:where(.dark, .dark *));
            @theme inline {
              --color-background: hsl(var(--background));
              --color-foreground: hsl(var(--foreground));
              --color-card: hsl(var(--card));
              --color-card-foreground: hsl(var(--card-foreground));
              --color-popover: hsl(var(--popover));
              --color-popover-foreground: hsl(var(--popover-foreground));
              --color-primary: hsl(var(--primary));
              --color-primary-foreground: hsl(var(--primary-foreground));
              --color-secondary: hsl(var(--secondary));
              --color-secondary-foreground: hsl(var(--secondary-foreground));
              --color-muted: hsl(var(--muted));
              --color-muted-foreground: hsl(var(--muted-foreground));
              --color-accent: hsl(var(--accent));
              --color-accent-foreground: hsl(var(--accent-foreground));
              --color-destructive: hsl(var(--destructive));
              --color-destructive-foreground: hsl(var(--destructive-foreground));
              --color-border: hsl(var(--border));
              --color-input: hsl(var(--input));
              --color-ring: hsl(var(--ring));
              --color-sidebar: hsl(var(--sidebar-background));
              --color-sidebar-foreground: hsl(var(--sidebar-foreground));
              --color-sidebar-primary: hsl(var(--sidebar-primary));
              --color-sidebar-primary-foreground: hsl(var(--sidebar-primary-foreground));
              --color-sidebar-accent: hsl(var(--sidebar-accent));
              --color-sidebar-accent-foreground: hsl(var(--sidebar-accent-foreground));
              --color-sidebar-border: hsl(var(--sidebar-border));
              --color-sidebar-ring: hsl(var(--sidebar-ring));
              --radius-lg: var(--radius);
              --radius-md: calc(var(--radius) - 2px);
              --radius-sm: calc(var(--radius) - 4px);
              --animate-accordion-down: accordion-down 0.2s ease-out;
              --animate-accordion-up: accordion-up 0.2s ease-out;
            }
            :root {
              --background: 0 0% 100%;
              --foreground: 222.2 84% 4.9%;
              --card: 0 0% 100%;
              --card-foreground: 222.2 84% 4.9%;
              --popover: 0 0% 100%;
              --popover-foreground: 222.2 84% 4.9%;
              --primary: 222.2 47.4% 11.2%;
              --primary-foreground: 210 40% 98%;
              --secondary: 210 40% 96.1%;
              --secondary-foreground: 222.2 47.4% 11.2%;
              --muted: 210 40% 96.1%;
              --muted-foreground: 215.4 16.3% 46.9%;
              --accent: 210 40% 96.1%;
              --accent-foreground: 222.2 47.4% 11.2%;
              --destructive: 0 84.2% 60.2%;
              --destructive-foreground: 210 40% 98%;
              --border: 214.3 31.8% 91.4%;
              --input: 214.3 31.8% 91.4%;
              --ring: 222.2 84% 4.9%;
              --radius: 0.5rem;
              --sidebar-background: 0 0% 98%;
              --sidebar-foreground: 240 5.3% 26.1%;
              --sidebar-primary: 240 5.9% 10%;
              --sidebar-primary-foreground: 0 0% 98%;
              --sidebar-accent: 240 4.8% 95.9%;
              --sidebar-accent-foreground: 240 5.9% 10%;
              --sidebar-border: 220 13% 91%;
              --sidebar-ring: 217.2 91.2% 59.8%;
            }
            @layer base {
              * { border-color: hsl(var(--border)); }
              body {
                background-color: hsl(var(--background));
                color: hsl(var(--foreground));
              }
            }
            @keyframes accordion-down {
              from { height: 0; }
              to { height: var(--radix-accordion-content-height); }
            }
            @keyframes accordion-up {
              from { height: var(--radix-accordion-content-height); }
              to { height: 0; }
            }
          </style>
          <script src="${origin}/@/workers/tw.worker.js"></script>
          <script type="importmap">
            ${JSON.stringify(importMap)}
          </script>
        </head>
        <body>
          <div id="embed"></div>
          <script type="module">
           import App from "${blobUrlForTranspiledCode}";
           import { renderApp } from "${origin}/@/lib/render-app.mjs";
           import { wait } from "${origin}/@/lib/wait.mjs";

                         let iteration = 0;

           renderApp({App:App}).then( async(renderedApp) => {

           while (renderedApp.rootElement.innerHTML === "" && iteration < 100) {
            iteration++;
          await wait(1);
          }

            renderedApp.toHtmlAndCss(renderedApp).then(({ html, css }) => {
             window.parent.postMessage({ type: "rendered", iteration: iteration, requestId: "${expectedRequestId}", data: { html, css } }, "*");
           });
           }
           );

          
          /*
           * The script inside the iframe imports the transpiled code (App) from the Blob URL.
           * It then uses \`renderApp\` (imported from an mjs bundle) to render the App.
           * A loop \`while (renderedApp.rootElement.innerHTML === "" && iteration < 100)\`
           * waits for the app to render something into the #embed div, with a timeout (100 iterations * 1ms wait).
           * Once rendered, it extracts HTML and CSS using \`toHtmlAndCss\` and posts it back to the parent window
           * using \`window.parent.postMessage\`. The \`requestId\` (md5 of transpiled code) ensures the parent
           * window can match this message to the correct render operation.
           */
          </script>
        </body>
        </html>`;

      if (replaceIframe) {
        const newIframe = document.createElement("iframe");
        newIframe.srcdoc = iframeSource;
        newIframe.title = "Live preview";
        newIframe.className = "w-full h-full border-0";
        replaceIframe(newIframe);
      } else {
        // Fallback: create a hidden iframe for headless rendering (no visible preview).
        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        document.body.appendChild(iframe);
        iframe.srcdoc = iframeSource;
      }

      // This Promise waits for the 'rendered' message from the iframe.
      // It sets up a message listener that filters for messages with the correct
      // type ('rendered') and requestId (matching the md5 of the transpiled code).
      // This ensures that we only process the result of the current render operation.
      const renderPromise = new Promise<void>((resolve, reject) => {
        const messageHandler = (event: MessageEvent<unknown>): void => {
          // Check if the message is from our iframe and matches the current render request
          if (isRenderedMessage(event.data, expectedRequestId)) {
            try {
              const { data } = event.data;
              const { html, css } = data;
              if (!html) {
                reject(new Error("Render produced empty HTML"));
                return;
              }
              Object.assign(processedSession, { html, css });
              resolve();
            } catch (error) {
              reject(
                new Error(
                  `Error processing render result: ${
                    error instanceof Error ? error.message : String(error)
                  }`,
                ),
              );
            }
          }
        };

        window.addEventListener("message", messageHandler);

        // Timeout for the iframe rendering operation. If the iframe doesn't post back
        // the 'rendered' message within RENDER_OPERATION_TIMEOUT_MS, this promise rejects.
        setTimeout(() => {
          reject(
            new Error(
              `Render timeout - iframe didn't respond within ${RENDER_OPERATION_TIMEOUT_MS}ms`,
            ),
          );
        }, RENDER_OPERATION_TIMEOUT_MS);
      });

      // Overall timeout for the entire `process` step (including iframe rendering).
      // This acts as a safety net to prevent the process from hanging indefinitely.
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(
              `Process timeout - operation took longer than ${OVERALL_PROCESS_TIMEOUT_MS}ms`,
            ),
          );
        }, OVERALL_PROCESS_TIMEOUT_MS);
      });

      const promises: Promise<unknown>[] = [renderPromise, timeoutPromise];

      if (signal) {
        const abortPromise = new Promise<void>((_, reject) => {
          if (signal.aborted) {
            reject(new DOMException("Aborted", "AbortError"));
          } else {
            signal.addEventListener(
              "abort",
              () => {
                reject(new DOMException("Aborted", "AbortError"));
              },
              { once: true },
            );
          }
        });
        promises.push(abortPromise);
      }

      // Race the `renderPromise` (waiting for iframe message) against the `timeoutPromise` and optionally `abortPromise`.
      // The first one to resolve or reject determines the outcome.
      const { error: raceError } = await tryCatch(Promise.race(promises));

      if (raceError) {
        // Don't log abort errors as errors
        if (!(raceError instanceof DOMException && raceError.name === "AbortError")) {
          console.error("Error during rendering (race condition or timeout):", raceError);
        }
        return false;
      }
    } catch (error) {
      console.error("Error running code in iframe (outer try-catch):", error);
      return false;
    }
    return true;
  }

  private async transpileCode(code: string): Promise<string> {
    const { data: transpiled, error } = await tryCatch(transpileCode(code));

    if (error) {
      console.error("Error Transpiled code:", { code, error }); // Changed to console.error and added error
      throw new Error(`Error transpiling code: ${error?.message || String(error)}`);
    }

    if (!transpiled) {
      console.error("Error Transpiled code: Transpilation resulted in empty output", { code }); // Changed to console.error
      throw new Error("Transpilation resulted in empty output");
    }

    return transpiled;
  }

  /**
   * Re-renders the app using transpiled code directly without formatting or transpiling.
   * Used when transpiled code changes from the server and we need to update HTML/CSS.
   */
  async reRenderFromTranspiled(
    transpiled: string,
    signal: AbortSignal,
    getSession: () => ICodeSession,
    replaceIframe?: (newIframe: HTMLIFrameElement) => void,
  ): Promise<ICodeSession | false> {
    const origin = window.location.origin;
    if (signal.aborted) return false;

    // Skip formatting and transpiling, go directly to rendering
    const processedSession = {
      code: getSession().code,
      transpiled: transpiled,
    };

    const executionSuccessful = await this._handleCodeExecutionInIframe(
      transpiled,
      origin,
      replaceIframe,
      processedSession,
      signal,
    );

    if (!executionSuccessful) {
      return false;
    }

    if (signal.aborted) {
      return false;
    }

    return {
      ...getSession(),
      ...processedSession,
      transpiled,
    };
  }

  async runCode(transpiled: string): Promise<RunMessageResult> {
    // Update the rendered app first
    const { data: renderedApp, error: updateError } = await tryCatch(
      CodeProcessor.renderService.updateRenderedApp({
        transpiled,
      }),
    );

    if (updateError) {
      console.error("Error updating rendered app:", { transpiled });
      throw new Error(`Error updating rendered app: ${String(updateError)}`);
    }

    const { data: result, error: renderError } = await tryCatch(
      CodeProcessor.renderService.handleRender(renderedApp),
    );

    if (renderError) {
      console.error("Error handling render:", { transpiled });
      throw new Error(`Error handling render: ${String(renderError)}`);
    }

    if (!result) {
      throw new Error("Running code produced no output");
    }

    return {
      html: result.html || "<div></div>",
      css: result.css || "",
    };
  }
}
