/**
 * Transpile helper — uses esbuild-wasm locally via the singleton initializer.
 *
 * Used by codespace API routes to convert raw source code into browser-ready JavaScript.
 */

export async function transpileCode(code: string, _origin = "https://spike.land"): Promise<string> {
  const { ensureEsbuildReady } = await import("./esbuild-init");
  await ensureEsbuildReady();
  const { transform } = await import("@spike-land-ai/esbuild-wasm");
  const result = await transform(code, {
    loader: "tsx",
    format: "esm",
    treeShaking: true,
    platform: "browser",
    minify: false,
    charset: "utf8",
    keepNames: true,
    tsconfigRaw: {
      compilerOptions: {
        jsx: "react-jsx",
        jsxFragmentFactory: "Fragment",
        jsxImportSource: "@emotion/react",
      },
    },
    target: "es2024",
  });
  return result.code;
}

/**
 * Transpile code for Worker-DOM rendering mode.
 *
 * Identical to transpileCode() but uses `react-ts-worker/react` as the JSX import source
 * instead of `@emotion/react`, so the generated JSX calls resolve to the custom React
 * implementation that runs inside a Web Worker.
 */
export async function transpileCodeWorkerDom(
  code: string,
  _origin = "https://spike.land",
): Promise<string> {
  const { ensureEsbuildReady } = await import("./esbuild-init");
  await ensureEsbuildReady();
  const { transform } = await import("@spike-land-ai/esbuild-wasm");
  const result = await transform(code, {
    loader: "tsx",
    format: "esm",
    treeShaking: true,
    platform: "browser",
    minify: false,
    charset: "utf8",
    keepNames: true,
    tsconfigRaw: {
      compilerOptions: {
        jsx: "react-jsx",
        jsxFragmentFactory: "Fragment",
        jsxImportSource: "react-ts-worker/react",
      },
    },
    target: "es2024",
  });
  return result.code;
}

/**
 * Parse transpilation error messages to extract line numbers and structured errors.
 * Ported from the Cloudflare Worker backend (testing.spike.land).
 */
export function parseTranspileErrors(
  errorMessage: string,
): Array<{ line?: number; column?: number; message: string }> {
  const errors: Array<{ line?: number; column?: number; message: string }> = [];
  const lines = errorMessage.split("\n");

  for (const line of lines) {
    if (/^\d+ error\(s\)/.test(line.trim())) continue;

    const lineColMatch = line.match(/:(\d+):(\d+):\s*(error|warning)?:?\s*(.+)/i);
    if (lineColMatch) {
      errors.push({
        line: parseInt(lineColMatch[1]!, 10),
        column: parseInt(lineColMatch[2]!, 10),
        message: lineColMatch[4]?.trim() || "Unknown error",
      });
      continue;
    }

    const lineMatch = line.match(/line\s+(\d+):\s*(.+)/i);
    if (lineMatch) {
      errors.push({
        line: parseInt(lineMatch[1]!, 10),
        message: lineMatch[2]?.trim() || "Unknown error",
      });
      continue;
    }

    const trimmed = line.trim();
    if (trimmed && !errors.some((e) => e.message === trimmed)) {
      errors.push({ message: trimmed });
    }
  }

  if (errors.length === 0 && errorMessage.trim()) {
    errors.push({ message: errorMessage.trim() });
  }

  return errors;
}
