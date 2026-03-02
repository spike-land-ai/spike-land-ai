export { tryCatch, errorResult, jsonResult } from "@spike-land-ai/mcp-server-base";

interface EsbuildError {
  errors?: unknown[];
  warnings?: unknown[];
  message?: string;
}

export function isEsbuildError(err: unknown): err is EsbuildError {
  return typeof err === "object" && err !== null && ("errors" in err || "message" in err);
}

/**
 * Format an esbuild-specific error into an MCP error result.
 * Preserves the esbuild `errors`/`warnings` structure.
 */
export function formatEsbuildError(err: Error): {
  content: { type: "text"; text: string }[];
  isError: true;
} {
  if (isEsbuildError(err)) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              errors: err.errors ?? [{ text: err.message ?? String(err) }],
              warnings: err.warnings ?? [],
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
    };
  }
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            errors: [{ text: String(err) }],
            warnings: [],
          },
          null,
          2,
        ),
      },
    ],
    isError: true,
  };
}
