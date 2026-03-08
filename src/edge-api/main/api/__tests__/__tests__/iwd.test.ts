import { describe, expect, it, vi, afterEach } from "vitest";
import { Hono } from "hono";
import { iwd, resolveGreeting } from "../../routes/iwd.js";
import type { Env } from "../../../core-logic/env.js";

interface VisitorRecord {
  id: string;
  latitude: number;
  longitude: number;
  city: string | null;
  country: string | null;
  locale: string | null;
  greeting: string | null;
  language_label: string | null;
  created_at: number;
}

interface MessageRecord {
  id: string;
  visitor_id: string;
  text: string;
  emoji_json: string;
  country: string | null;
  city: string | null;
  latitude: number;
  longitude: number;
  locale: string | null;
  greeting: string | null;
  image_prompt: string | null;
  image_job_id: string | null;
  image_url: string | null;
  image_status: string;
  error_message: string | null;
  created_at: number;
  updated_at: number;
}

interface MockStmt {
  bind: (...args: unknown[]) => MockStmt;
  all: () => Promise<{ results: Array<Record<string, unknown>> }>;
  first: <T>() => Promise<T | null>;
  run: () => Promise<{ success: boolean; meta: { changes: number } }>;
}

function createMockDB(state: {
  visitors?: VisitorRecord[];
  messages?: MessageRecord[];
}) {
  const visitors = [...(state.visitors ?? [])];
  const messages = [...(state.messages ?? [])];
  let visitorCounter = visitors.length + 1;
  let messageCounter = messages.length + 1;

  const db = {
    prepare: vi.fn((sql: string) => {
      let bindings: unknown[] = [];
      const stmt: MockStmt = {
        bind: (...args: unknown[]) => {
          bindings = args;
          return stmt;
        },
        all: async () => {
          if (sql.includes("FROM iwd_visitors WHERE created_at >= ? ORDER BY created_at ASC")) {
            const since = Number(bindings[0] ?? 0);
            return {
              results: visitors.filter((visitor) => visitor.created_at >= since) as Array<
                Record<string, unknown>
              >,
            };
          }

          if (sql.includes("FROM iwd_messages WHERE created_at >= ? AND updated_at >= ?")) {
            const dayStart = Number(bindings[0] ?? 0);
            const updatedSince = Number(bindings[1] ?? 0);
            return {
              results: messages.filter(
                (message) => message.created_at >= dayStart && message.updated_at >= updatedSince,
              ) as Array<Record<string, unknown>>,
            };
          }

          if (sql.includes("GROUP BY country")) {
            const dayStart = Number(bindings[0] ?? 0);
            const counts = visitors
              .filter((visitor) => visitor.created_at >= dayStart && visitor.country)
              .reduce<Map<string, number>>((acc, visitor) => {
                const key = visitor.country!;
                acc.set(key, (acc.get(key) ?? 0) + 1);
                return acc;
              }, new Map());

            return {
              results: Array.from(counts.entries())
                .map(([country, count]) => ({ country, count }))
                .sort((a, b) => (b.count === a.count ? a.country.localeCompare(b.country) : b.count - a.count)),
            };
          }

          return { results: [] };
        },
        first: async <T>() => {
          if (sql.includes("FROM iwd_visitors WHERE id = ?")) {
            const [id, since] = bindings;
            const row =
              visitors.find(
                (visitor) => visitor.id === id && visitor.created_at >= Number(since ?? 0),
              ) ?? null;
            return row as T | null;
          }

          if (sql.includes("WHERE latitude = ? AND longitude = ? AND city IS ?")) {
            const [latitude, longitude, city, since] = bindings;
            const row =
              visitors.find(
                (visitor) =>
                  visitor.latitude === latitude &&
                  visitor.longitude === longitude &&
                  visitor.city === city &&
                  visitor.created_at >= Number(since ?? 0),
              ) ?? null;
            return row as T | null;
          }

          if (sql.includes("SELECT COUNT(*) AS count FROM iwd_visitors")) {
            const since = Number(bindings[0] ?? 0);
            return {
              count: visitors.filter((visitor) => visitor.created_at >= since).length,
            } as T;
          }

          if (sql.startsWith("INSERT INTO iwd_visitors")) {
            const [latitude, longitude, city, country, locale, greeting, languageLabel] = bindings;
            const row: VisitorRecord = {
              id: `visitor-${visitorCounter++}`,
              latitude: Number(latitude),
              longitude: Number(longitude),
              city: typeof city === "string" ? city : null,
              country: typeof country === "string" ? country : null,
              locale: typeof locale === "string" ? locale : null,
              greeting: typeof greeting === "string" ? greeting : null,
              language_label: typeof languageLabel === "string" ? languageLabel : null,
              created_at: Date.now(),
            };
            visitors.push(row);
            return row as T;
          }

          if (sql.includes("SELECT created_at FROM iwd_messages WHERE visitor_id = ?")) {
            const visitorId = String(bindings[0] ?? "");
            const row =
              [...messages]
                .filter((message) => message.visitor_id === visitorId)
                .sort((a, b) => b.created_at - a.created_at)[0] ?? null;
            return (row ? { created_at: row.created_at } : null) as T | null;
          }

          if (sql.startsWith("INSERT INTO iwd_messages")) {
            const [
              visitorId,
              text,
              emojiJson,
              country,
              city,
              latitude,
              longitude,
              locale,
              greeting,
              updatedAt,
            ] = bindings;
            const row: MessageRecord = {
              id: `message-${messageCounter++}`,
              visitor_id: String(visitorId),
              text: String(text),
              emoji_json: String(emojiJson),
              country: typeof country === "string" ? country : null,
              city: typeof city === "string" ? city : null,
              latitude: Number(latitude),
              longitude: Number(longitude),
              locale: typeof locale === "string" ? locale : null,
              greeting: typeof greeting === "string" ? greeting : null,
              image_prompt: null,
              image_job_id: null,
              image_url: null,
              image_status: "PROCESSING",
              error_message: null,
              created_at: Date.now(),
              updated_at: Number(updatedAt),
            };
            messages.push(row);
            return row as T;
          }

          return null;
        },
        run: async () => ({ success: true, meta: { changes: 1 } }),
      };

      return stmt;
    }),
  } as unknown as D1Database;

  return { db, visitors, messages };
}

function createApp(envOverrides: Partial<Env> = {}) {
  const app = new Hono<{ Bindings: Env }>();
  app.route("/", iwd);
  return { app, env: envOverrides as Env };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolveGreeting", () => {
  it("prefers the visitor language when supported", () => {
    const greeting = resolveGreeting("es-ES,es;q=0.9,en;q=0.8", "GB");
    expect(greeting.locale).toBe("es");
    expect(greeting.greeting).toContain("Feliz");
  });
});

describe("GET /iwd", () => {
  it("renders festive OG metadata and a localized greeting", async () => {
    const { db } = createMockDB({});
    const { app, env } = createApp({ DB: db });

    const response = await app.request("/iwd", {
      headers: { "Accept-Language": "ja-JP,ja;q=0.9" },
    }, env);

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("/iwd/og.svg");
    expect(html).toContain("国際女性デーおめでとうございます");
    expect(html).toContain("Share It Everywhere");
  });
});

describe("POST /api/iwd/checkin", () => {
  it("creates a visitor, returns the feed payload, and sets a cookie", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const { db } = createMockDB({});
    const { app, env } = createApp({ DB: db });

    const response = await app.request("/api/iwd/checkin", {
      method: "POST",
      headers: { "Accept-Language": "es-ES,es;q=0.9" },
    }, env);

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("iwd_visitor=");

    const data = (await response.json()) as {
      isNew: boolean;
      totalVisitors: number;
      visitor: { country: string; greeting: string };
      viewerGreeting: { locale: string };
      leaderboard: Array<{ country: string; count: number }>;
    };

    expect(data.isNew).toBe(true);
    expect(data.totalVisitors).toBe(1);
    expect(data.viewerGreeting.locale).toBe("es");
    expect(data.visitor.country).toBe("GB");
    expect(data.leaderboard[0]).toMatchObject({ country: "GB", count: 1 });
  });
});

describe("GET /api/iwd/feed", () => {
  it("returns visitors, messages, and country leaderboard", async () => {
    const now = Date.now();
    const { db } = createMockDB({
      visitors: [
        {
          id: "visitor-a",
          latitude: 51.5,
          longitude: -0.12,
          city: "London",
          country: "GB",
          locale: "en",
          greeting: "Happy International Women's Day",
          language_label: "English",
          created_at: now - 3_000,
        },
        {
          id: "visitor-b",
          latitude: 40.4,
          longitude: -3.7,
          city: "Madrid",
          country: "ES",
          locale: "es",
          greeting: "Feliz Día Internacional de la Mujer",
          language_label: "Español",
          created_at: now - 2_000,
        },
        {
          id: "visitor-c",
          latitude: 41.3,
          longitude: 2.1,
          city: "Barcelona",
          country: "ES",
          locale: "es",
          greeting: "Feliz Día Internacional de la Mujer",
          language_label: "Español",
          created_at: now - 1_000,
        },
      ],
      messages: [
        {
          id: "message-a",
          visitor_id: "visitor-b",
          text: "Vamos juntas",
          emoji_json: JSON.stringify(["🌸", "✨"]),
          country: "ES",
          city: "Madrid",
          latitude: 40.4,
          longitude: -3.7,
          locale: "es",
          greeting: "Feliz Día Internacional de la Mujer",
          image_prompt: "prompt",
          image_job_id: "job-1",
          image_url: "https://image-studio-mcp.spike.land/demo/image.png",
          image_status: "COMPLETED",
          error_message: null,
          created_at: now - 900,
          updated_at: now - 900,
        },
      ],
    });

    const { app, env } = createApp({ DB: db });
    const response = await app.request("/api/iwd/feed", undefined, env);

    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      totalVisitors: number;
      leaderboard: Array<{ country: string; count: number; greeting: string }>;
      messages: Array<{ imageStatus: string; imageUrl: string; emojis: string[] }>;
    };

    expect(data.totalVisitors).toBe(3);
    expect(data.leaderboard[0]).toMatchObject({
      country: "ES",
      count: 2,
      greeting: "Feliz Día Internacional de la Mujer",
    });
    expect(data.messages[0]).toMatchObject({
      imageStatus: "COMPLETED",
      imageUrl: "https://image-studio-mcp.spike.land/demo/image.png",
      emojis: ["🌸", "✨"],
    });
  });
});

describe("POST /api/iwd/message", () => {
  it("rejects empty submissions even when the visitor session exists", async () => {
    const now = Date.now();
    const { db } = createMockDB({
      visitors: [
        {
          id: "visitor-x",
          latitude: 51.5,
          longitude: -0.12,
          city: "London",
          country: "GB",
          locale: "en",
          greeting: "Happy International Women's Day",
          language_label: "English",
          created_at: now,
        },
      ],
    });

    const { app, env } = createApp({ DB: db });
    const response = await app.request("/api/iwd/message", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: "iwd_visitor=visitor-x",
      },
      body: JSON.stringify({ text: "   ", emojis: [] }),
    }, env);

    expect(response.status).toBe(400);
    const data = (await response.json()) as { error: string };
    expect(data.error).toContain("short note");
  });
});
