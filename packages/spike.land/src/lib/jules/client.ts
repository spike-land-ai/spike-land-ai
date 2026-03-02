/**
 * Jules API Client
 *
 * Shared client for interacting with the Jules (Google) coding assistant API.
 * Extracted from src/lib/mcp/server/tools/jules.ts for reuse across the app.
 */

const JULES_BASE_URL = "https://jules.googleapis.com/v1alpha";
const SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export interface JulesSession {
  name: string;
  state: string;
  title?: string;
  url?: string;
  planSummary?: string;
}

export interface JulesActivity {
  type?: string;
  content?: string;
}

export interface JulesCreateSessionParams {
  title: string;
  task: string;
  sourceRepo?: string;
  startingBranch?: string;
}

function validateSessionId(sessionId: string): void {
  const id = sessionId.replace(/^sessions\//, "");
  if (!SESSION_ID_PATTERN.test(id)) {
    throw new Error(`Invalid session ID format: ${sessionId}`);
  }
}

function normalizeSessionName(sessionId: string): string {
  return sessionId.startsWith("sessions/") ? sessionId : `sessions/${sessionId}`;
}

export async function julesRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<{ data: T | null; error: string | null }> {
  const apiKey = process.env.JULES_API_KEY;
  if (!apiKey) {
    return { data: null, error: "Jules API not configured on server" };
  }

  try {
    const response = await fetch(`${JULES_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        "X-Goog-Api-Key": apiKey,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
    const json = await response.json();
    if (!response.ok) {
      return {
        data: null,
        error:
          (json as { error?: { message?: string } })?.error?.message ||
          `API error: ${response.status}`,
      };
    }
    return { data: json as T, error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export function isJulesAvailable(): boolean {
  return !!process.env.JULES_API_KEY;
}

export async function listSessions(options?: {
  status?: string;
  pageSize?: number;
}): Promise<{ data: JulesSession[] | null; error: string | null }> {
  const params = new URLSearchParams();
  if (options?.pageSize) params.set("pageSize", String(options.pageSize));

  const result = await julesRequest<{ sessions: JulesSession[] }>(
    `/sessions${params.toString() ? `?${params}` : ""}`,
  );

  if (result.error) return { data: null, error: result.error };

  let sessions = result.data?.sessions || [];
  if (options?.status) {
    sessions = sessions.filter((s) => s.state === options.status);
  }

  return { data: sessions, error: null };
}

export async function createSession(
  params: JulesCreateSessionParams,
): Promise<{ data: JulesSession | null; error: string | null }> {
  const source = params.sourceRepo
    ? `sources/github/${params.sourceRepo}`
    : `sources/github/${process.env.GITHUB_OWNER || "spike-land-ai"}/${
        process.env.GITHUB_REPO || "spike.land"
      }`;

  return julesRequest<JulesSession>("/sessions", {
    method: "POST",
    body: JSON.stringify({
      prompt: params.task,
      sourceContext: {
        source,
        githubRepoContext: {
          startingBranch: params.startingBranch || "main",
        },
      },
      title: params.title,
      requirePlanApproval: true,
      automationMode: "AUTO_CREATE_PR",
    }),
  });
}

export async function getSession(
  sessionId: string,
  options?: { includeActivities?: boolean },
): Promise<{
  data: (JulesSession & { activities?: JulesActivity[] }) | null;
  error: string | null;
}> {
  validateSessionId(sessionId);
  const name = normalizeSessionName(sessionId);

  const result = await julesRequest<JulesSession>(`/${name}`);
  if (result.error || !result.data) return { data: null, error: result.error };

  const session: JulesSession & { activities?: JulesActivity[] } = result.data;

  if (options?.includeActivities) {
    const activities = await julesRequest<{ activities: JulesActivity[] }>(
      `/${name}/activities?pageSize=10`,
    );
    if (activities.data?.activities) {
      session.activities = activities.data.activities;
    }
  }

  return { data: session, error: null };
}

export async function approveSessionPlan(
  sessionId: string,
): Promise<{ data: { state: string } | null; error: string | null }> {
  validateSessionId(sessionId);
  const name = normalizeSessionName(sessionId);
  return julesRequest<{ state: string }>(`/${name}:approvePlan`, {
    method: "POST",
  });
}

export async function sendMessage(
  sessionId: string,
  message: string,
): Promise<{ data: { state: string } | null; error: string | null }> {
  validateSessionId(sessionId);
  const name = normalizeSessionName(sessionId);
  return julesRequest<{ state: string }>(`/${name}:sendMessage`, {
    method: "POST",
    body: JSON.stringify({ prompt: message }),
  });
}
