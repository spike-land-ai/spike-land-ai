/**
 * API client for vibe-dev agent
 *
 * Communicates with spike.land API endpoints for:
 * - Fetching app context and chat history
 * - Posting agent responses
 * - Updating app properties
 */

export interface AppContext {
  app: {
    id: string;
    name: string;
    description: string | null;
    status: string;
    codespaceId: string | null;
    codespaceUrl: string | null;
    isPublic: boolean;
    slug: string | null;
  };
  requirements: Array<{
    id: string;
    content: string;
    priority: number;
    status: string;
  }>;
  chatHistory: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  role: "USER" | "AGENT" | "SYSTEM";
  content: string;
  createdAt: string;
  isRead: boolean;
  attachments: Array<{
    image: {
      id: string;
      originalUrl: string;
      aiDescription: string | null;
      tags: string[];
    };
  }>;
}

export interface AgentResponse {
  content: string;
  codeUpdated: boolean;
  processedMessageIds: string[];
  metadata?: Record<string, unknown>;
}

export interface ApiConfig {
  baseUrl: string;
  apiKey: string;
}

/**
 * Get API configuration from environment
 */
export function getApiConfig(): ApiConfig {
  const baseUrl =
    process.env.SPIKE_LAND_API_URL || process.env.NEXT_PUBLIC_APP_URL || "https://spike.land";
  const apiKey = process.env.AGENT_API_KEY;

  if (!apiKey) {
    throw new Error("AGENT_API_KEY not configured. Set AGENT_API_KEY environment variable.");
  }

  return { baseUrl, apiKey };
}

/**
 * Make authenticated API request
 */
async function apiRequest<T>(
  config: ApiConfig,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${config.baseUrl}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API request failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Get app context and chat history
 */
export async function getAppContext(
  config: ApiConfig,
  appId: string,
  historyLimit = 10,
): Promise<AppContext> {
  return apiRequest<AppContext>(
    config,
    `/api/agent/apps/${appId}/context?historyLimit=${historyLimit}`,
  );
}

/**
 * Get message content by ID
 */
export async function getMessageContent(
  config: ApiConfig,
  messageId: string,
): Promise<ChatMessage> {
  return apiRequest<ChatMessage>(config, `/api/agent/messages/${messageId}`);
}

/**
 * Post agent response
 */
export async function postAgentResponse(
  config: ApiConfig,
  appId: string,
  response: AgentResponse,
): Promise<{ id: string }> {
  return apiRequest<{ id: string }>(config, `/api/agent/apps/${appId}/respond`, {
    method: "POST",
    body: JSON.stringify(response),
  });
}

/**
 * Update app properties (codespace, status, etc.)
 */
export async function updateApp(
  config: ApiConfig,
  appId: string,
  update: {
    name?: string;
    description?: string;
    status?: string;
    statusMessage?: string;
    codespaceId?: string;
    isPublic?: boolean;
    agentMessage?: string;
    systemMessage?: string;
  },
): Promise<{ id: string }> {
  return apiRequest<{ id: string }>(config, `/api/apps/${appId}/agent`, {
    method: "PATCH",
    body: JSON.stringify(update),
  });
}

/**
 * Set agent working status
 */
export async function setAgentWorkingApi(
  config: ApiConfig,
  appId: string,
  isWorking: boolean,
): Promise<void> {
  await apiRequest<{ success: boolean }>(config, `/api/apps/${appId}/agent`, {
    method: "POST",
    body: JSON.stringify({ isWorking }),
  });
}

/**
 * Mark message as read
 */
export async function markMessageRead(config: ApiConfig, messageId: string): Promise<void> {
  await apiRequest<{ id: string }>(config, `/api/agent/messages/${messageId}`, {
    method: "PATCH",
    body: JSON.stringify({ isRead: true }),
  });
}
