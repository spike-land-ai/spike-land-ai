const API_BASE = "";
const TOKEN = import.meta.env.VITE_DEMO_TOKEN ?? "demo";

export interface ToolResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

export interface ToolInputSchema {
  type: "object";
  properties: Record<
    string,
    {
      type?: string;
      enum?: string[];
      description?: string;
      items?: { type: string };
      default?: unknown;
    }
  >;
  required?: string[];
}

export interface ToolInfo {
  name: string;
  description: string;
  category: string;
  tier: string;
  inputSchema?: ToolInputSchema;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const geminiKey = localStorage.getItem("gemini_api_key");
  const imageModel = localStorage.getItem("pref_image_model");
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
      ...(geminiKey ? { "X-Gemini-Key": geminiKey } : {}),
      ...(imageModel ? { "X-Image-Model": imageModel } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

export async function callTool(
  name: string,
  args: Record<string, unknown> = {},
): Promise<ToolResult> {
  const { result } = await apiFetch<{ result: ToolResult }>("/api/tool", {
    method: "POST",
    body: JSON.stringify({ name, arguments: args }),
  });
  return result;
}

export function parseToolResult<T = unknown>(result: ToolResult): T {
  if (result.isError) {
    const text = result.content[0]?.text ?? "Unknown error";
    throw new Error(text);
  }
  const text = result.content[0]?.text;
  if (!text) throw new Error("Empty result");
  return JSON.parse(text) as T;
}

export async function listTools(): Promise<ToolInfo[]> {
  const { tools } = await apiFetch<{ tools: ToolInfo[] }>("/api/tools");
  return tools;
}
