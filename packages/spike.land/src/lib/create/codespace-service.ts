import { upsertSession } from "@/lib/codespace";
import { transpileCode } from "@/lib/codespace/transpile";
import logger from "@/lib/logger";

export interface CodespaceResponse {
  success: boolean;
  error?: string;
  url?: string;
  /** Structured errors from esbuild when transpilation fails. */
  structuredErrors?: Array<{ line?: number; column?: number; message: string }>;
}

/**
 * Syncs a codespace with the testing.spike.land backend worker.
 */
export async function syncCodespaceWithWorker(codespaceId: string, code: string): Promise<boolean> {
  try {
    const componentUrl = process.env.SPIKE_LAND_COMPONENT_URL ?? "https://testing.spike.land";
    const response = await fetch(`${componentUrl}/api-v1/${codespaceId}/code`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code, run: true }),
    });

    if (!response.ok) {
      const text = await response.text();
      logger.warn(`Failed to sync codespace ${codespaceId} with worker: ${text}`);
      return false;
    }

    return true;
  } catch (error) {
    logger.error(`Error syncing codespace ${codespaceId} with worker:`, {
      error,
    });
    return false;
  }
}

/**
 * Creates or updates a codespace with the given code.
 * Now calls the session service directly instead of the CF Worker.
 */
export async function updateCodespace(
  codespaceId: string,
  code: string,
): Promise<CodespaceResponse> {
  try {
    // Transpile via js.spike.land
    let transpiled = "";
    try {
      transpiled = await transpileCode(code, "https://spike.land");
    } catch (error) {
      logger.error(`Failed to transpile codespace ${codespaceId}:`, { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Transpilation failed",
      };
    }

    // Save to DB via session service
    await upsertSession({
      codeSpace: codespaceId,
      code,
      transpiled,
      html: "",
      css: "",
      messages: [],
    });

    // PUSH to testing.spike.land as well!
    syncCodespaceWithWorker(codespaceId, code).catch((err) => {
      logger.error(`Background sync failed for ${codespaceId}:`, { err });
    });

    return {
      success: true,
      url: `/api/codespace/${codespaceId}/embed`,
    };
  } catch (error) {
    logger.error(`Error updating codespace ${codespaceId}:`, { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get the live URL for a codespace
 */
export function getCodespaceUrl(codespaceId: string): string {
  return `/api/codespace/${codespaceId}/embed`;
}

/**
 * Generate a consistent codespace ID from a slug.
 * The backend only allows IDs with at most 2 hyphen-separated parts (e.g., "x-abc123").
 * We use a hash of the slug to ensure uniqueness while staying within constraints.
 * e.g. "cooking/pasta" -> "c-a1b2c3d4"
 */
export function generateCodespaceId(slug: string): string {
  // Create a simple hash from the slug for uniqueness
  // Using a basic hash that produces 8 hex chars
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    const char = slug.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  const hashHex = Math.abs(hash).toString(16).padStart(8, "0").slice(0, 8);
  return `c-${hashHex}`;
}
