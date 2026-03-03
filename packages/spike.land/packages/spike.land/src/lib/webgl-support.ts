/**
 * Detects whether the current browser supports WebGL context creation.
 * Tries WebGL2 first, then falls back to WebGL1.
 *
 * Returns false in headless/sandboxed browsers or when the GPU is unavailable.
 */
export function hasWebGLSupport(): boolean {
  if (typeof document === "undefined") return false;

  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * Checks whether a given error is a WebGL context-creation failure.
 * Used by error boundaries to decide whether to show a WebGL-specific fallback.
 */
export function isWebGLContextError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("webgl")
    || msg.includes("context could not be created")
    || msg.includes("error creating")
    || msg.includes("webgl2")
  );
}
