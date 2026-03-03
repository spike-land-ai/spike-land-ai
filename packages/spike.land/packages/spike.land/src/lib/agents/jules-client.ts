/**
 * Jules API Client
 *
 * Client for interacting with Google's Jules async coding agent API.
 * Uses lazy initialization pattern - only creates client when API key is available.
 *
 * @see https://developers.google.com/jules/api
 */

import { tryCatch } from "@/lib/try-catch";
import type {
  CreateSessionRequest,
  JulesActivity,
  JulesApiError,
  JulesSession,
  JulesSource,
  ListActivitiesResponse,
  ListSessionsResponse,
  ListSourcesResponse,
} from "./jules-types";

const JULES_BASE_URL = "https://jules.googleapis.com/v1alpha";

/**
 * Pattern for validating session IDs (alphanumeric with hyphens and underscores)
 */
const SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * Validate session ID format to prevent path traversal attacks
 * @throws Error if session ID format is invalid
 */
function validateSessionId(sessionId: string): void {
  const id = sessionId.replace(/^sessions\//, "");
  if (!SESSION_ID_PATTERN.test(id)) {
    throw new Error(`Invalid session ID format: ${sessionId}`);
  }
}

/**
 * Check if Jules API is available (API key is configured)
 */
export function isJulesAvailable(): boolean {
  return !!process.env.JULES_API_KEY;
}

/**
 * Get the Jules API key from environment
 * @throws Error if JULES_API_KEY is not set
 */
function getApiKey(): string {
  const apiKey = process.env.JULES_API_KEY;
  if (!apiKey) {
    throw new Error("JULES_API_KEY environment variable is not set");
  }
  return apiKey;
}

/**
 * Make a request to the Jules API
 */
async function julesRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<{ data: T | null; error: string | null; }> {
  const apiKey = getApiKey();
  const url = `${JULES_BASE_URL}${endpoint}`;

  const { data: response, error: fetchError } = await tryCatch(
    fetch(url, {
      ...options,
      headers: {
        "X-Goog-Api-Key": apiKey,
        "Content-Type": "application/json",
        ...options.headers,
      },
    }),
  );

  if (fetchError) {
    return { data: null, error: `Network error: ${fetchError.message}` };
  }

  if (!response) {
    return { data: null, error: "No response received" };
  }

  const { data: json, error: jsonError } = await tryCatch(response.json());

  if (jsonError) {
    return {
      data: null,
      error: `Failed to parse response: ${jsonError.message}`,
    };
  }

  if (!response.ok) {
    const apiError = json as JulesApiError;
    return {
      data: null,
      error: apiError?.error?.message || `API error: ${response.status}`,
    };
  }

  return { data: json as T, error: null };
}

// =============================================================================
// Sources API
// =============================================================================

/**
 * List all available sources (GitHub repositories)
 */
export async function listSources(pageSize = 50, pageToken?: string): Promise<{
  data: { sources: JulesSource[]; nextPageToken?: string; } | null;
  error: string | null;
}> {
  const params = new URLSearchParams();
  if (pageSize) params.set("pageSize", String(pageSize));
  if (pageToken) params.set("pageToken", pageToken);

  const query = params.toString();
  return julesRequest<ListSourcesResponse>(
    `/sources${query ? `?${query}` : ""}`,
  );
}

/**
 * Get a specific source by name
 */
export async function getSource(
  name: string,
): Promise<{ data: JulesSource | null; error: string | null; }> {
  return julesRequest<JulesSource>(`/${name}`);
}

// =============================================================================
// Sessions API
// =============================================================================

/**
 * List all sessions with optional pagination
 */
export async function listSessions(pageSize = 20, pageToken?: string): Promise<{
  data: { sessions: JulesSession[]; nextPageToken?: string; } | null;
  error: string | null;
}> {
  const params = new URLSearchParams();
  if (pageSize) params.set("pageSize", String(pageSize));
  if (pageToken) params.set("pageToken", pageToken);

  const query = params.toString();
  return julesRequest<ListSessionsResponse>(
    `/sessions${query ? `?${query}` : ""}`,
  );
}

/**
 * Get a specific session by name
 */
export async function getSession(
  sessionName: string,
): Promise<{ data: JulesSession | null; error: string | null; }> {
  validateSessionId(sessionName);
  const name = sessionName.startsWith("sessions/")
    ? sessionName
    : `sessions/${sessionName}`;
  return julesRequest<JulesSession>(`/${name}`);
}

/**
 * Create a new session
 */
export async function createSession(
  request: CreateSessionRequest,
): Promise<{ data: JulesSession | null; error: string | null; }> {
  return julesRequest<JulesSession>("/sessions", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

/**
 * Approve a plan in a session
 */
export async function approvePlan(
  sessionName: string,
): Promise<{ data: JulesSession | null; error: string | null; }> {
  validateSessionId(sessionName);
  const name = sessionName.startsWith("sessions/")
    ? sessionName
    : `sessions/${sessionName}`;
  return julesRequest<JulesSession>(`/${name}:approvePlan`, {
    method: "POST",
  });
}

/**
 * Send a message to a session
 */
export async function sendMessage(
  sessionName: string,
  message: string,
): Promise<{ data: JulesSession | null; error: string | null; }> {
  validateSessionId(sessionName);
  const name = sessionName.startsWith("sessions/")
    ? sessionName
    : `sessions/${sessionName}`;
  return julesRequest<JulesSession>(`/${name}:sendMessage`, {
    method: "POST",
    body: JSON.stringify({ prompt: message }),
  });
}

// =============================================================================
// Activities API
// =============================================================================

/**
 * List activities for a session
 */
export async function listActivities(
  sessionName: string,
  pageSize = 50,
  pageToken?: string,
): Promise<{
  data: { activities: JulesActivity[]; nextPageToken?: string; } | null;
  error: string | null;
}> {
  validateSessionId(sessionName);
  const name = sessionName.startsWith("sessions/")
    ? sessionName
    : `sessions/${sessionName}`;
  const params = new URLSearchParams();
  if (pageSize) params.set("pageSize", String(pageSize));
  if (pageToken) params.set("pageToken", pageToken);

  const query = params.toString();
  return julesRequest<ListActivitiesResponse>(
    `/${name}/activities${query ? `?${query}` : ""}`,
  );
}

/**
 * Get a specific activity by name
 */
export async function getActivity(
  activityName: string,
): Promise<{ data: JulesActivity | null; error: string | null; }> {
  return julesRequest<JulesActivity>(`/${activityName}`);
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Build source name from owner/repo
 */
export function buildSourceName(owner: string, repo: string): string {
  return `sources/github/${owner}/${repo}`;
}

/**
 * Extract session ID from resource name
 */
export function extractSessionId(sessionName: string): string {
  return sessionName.replace("sessions/", "");
}
