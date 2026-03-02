/**
 * Sync module for testing.spike.land code management
 */

const TESTING_SPIKE_LAND_URL = process.env.TESTING_SPIKE_LAND_URL || "https://testing.spike.land";

interface SessionResponse {
  code?: string;
  cSess?: { code?: string };
}

interface CodeUpdateResponse {
  success: boolean;
  codeSpace: string;
  hash: string;
  updated: string[];
  message: string;
}

/**
 * Download code from testing.spike.land
 */
export async function pullCode(codespaceId: string): Promise<string> {
  const url = `${TESTING_SPIKE_LAND_URL}/live/${codespaceId}/session.json`;

  const response = await fetch(url);

  if (!response.ok) {
    if (response.status === 404) {
      // Codespace doesn't exist - return placeholder
      return createPlaceholder(codespaceId);
    }
    throw new Error(`Failed to fetch code: HTTP ${response.status}`);
  }

  const session = (await response.json()) as SessionResponse;
  return session.code || session.cSess?.code || "";
}

/**
 * Push code to testing.spike.land
 *
 * @param codespaceId - The codespace ID
 * @param code - The code to sync
 * @param run - Whether to transpile (default: true for instant preview)
 */
export async function pushCode(
  codespaceId: string,
  code: string,
  run = true,
): Promise<CodeUpdateResponse> {
  const url = `${TESTING_SPIKE_LAND_URL}/live/${codespaceId}/api/code`;

  const response = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, run }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to push code: HTTP ${response.status} - ${errorText}`);
  }

  return (await response.json()) as CodeUpdateResponse;
}

/**
 * Create placeholder code for a new codespace
 */
function createPlaceholder(codespaceId: string): string {
  return `// New codespace: ${codespaceId}
// Edit this file and changes will sync automatically

export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">
          Hello from ${codespaceId} 👋
        </h1>
        <p className="text-gray-600">
          Start editing to see live changes
        </p>
      </div>
    </div>
  );
}
`;
}

/**
 * Retry wrapper with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelayMs = 100,
): Promise<T> {
  let lastError: Error | null = null;
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`  Attempt ${attempt}/${maxRetries} failed: ${lastError.message}`);

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
      }
    }
  }

  throw lastError;
}
