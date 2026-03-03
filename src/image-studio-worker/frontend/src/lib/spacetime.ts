/**
 * Lightweight SpacetimeDB client for chat message persistence.
 * Uses the app_message table via HTTP API (fetch-based, no SDK dependency).
 * Falls back gracefully if SpacetimeDB is unavailable.
 */

const STDB_HOST = "https://maincloud.spacetimedb.com";
const STDB_DB = "rightful-dirt-5033";
const IMAGE_STUDIO_APP_ID = "image-studio-mcp";

interface AppMessage {
  id: string;
  appId: string;
  role: string;
  content: string;
  createdAt: number;
}

async function stdbFetch(path: string, options?: RequestInit): Promise<Response | null> {
  try {
    const res = await fetch(`${STDB_HOST}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
    });
    if (!res.ok) return null;
    return res;
  } catch {
    return null;
  }
}

export async function loadChatHistory(): Promise<AppMessage[]> {
  const res = await stdbFetch(
    `/database/${STDB_DB}/sql`,
    {
      method: "POST",
      body: `SELECT * FROM app_message WHERE app_id = '${IMAGE_STUDIO_APP_ID}' ORDER BY created_at ASC LIMIT 100`,
    },
  );
  if (!res) return [];

  try {
    const data = await res.json() as { rows?: AppMessage[] };
    return data.rows || [];
  } catch {
    return [];
  }
}

export async function saveChatMessage(role: string, content: string): Promise<void> {
  await stdbFetch(
    `/database/${STDB_DB}/call/send_app_message`,
    {
      method: "POST",
      body: JSON.stringify([IMAGE_STUDIO_APP_ID, role, content]),
    },
  );
}

export { type AppMessage };
