/**
 * Codespace Standalone Tools
 *
 * Live React application management, virtual filesystem, and template tools.
 * Migrated from:
 *   - src/lib/mcp/server/tools/codespace.ts
 *   - src/lib/mcp/server/tools/filesystem.ts
 *   - src/lib/mcp/server/tools/codespace-templates.ts
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ServerContext, StandaloneToolDefinition } from "../shared/types";
import { errorResult, safeToolCall, textResult } from "../shared/tool-helpers";

// ── Constants ──────────────────────────────────────────────────────────────

const SPIKE_LAND_BASE_URL = "https://spike.land";
const COMPONENT_URL = process.env.SPIKE_LAND_COMPONENT_URL || "https://testing.spike.land";
const CODESPACE_ID_PATTERN = /^[a-zA-Z0-9_.-]+$/;

const MAX_FILE_SIZE_BYTES = 1_048_576; // 1 MB
const MAX_FILE_COUNT = 100;
const MAX_TOTAL_SIZE_BYTES = 52_428_800; // 50 MB
const ENTRY_POINT = "/src/App.tsx";
const DEFAULT_TTL_MS = 60 * 60 * 1000;

// ── Validation ─────────────────────────────────────────────────────────────

function validateCodeSpaceId(id: string): void {
  if (!CODESPACE_ID_PATTERN.test(id)) {
    throw new Error(`Invalid codespace ID format: ${id}`);
  }
}

// ── HTTP helper ────────────────────────────────────────────────────────────

async function spikeLandRequest<T>(
  endpoint: string,
  apiKey: string,
  options: RequestInit = {},
): Promise<{ data: T | null; error: string | null }> {
  try {
    const url = `${SPIKE_LAND_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
    const json = await response.json();
    if (!response.ok) {
      return {
        data: null,
        error: (json as { error?: string })?.error || `API error: ${response.status}`,
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

// ── In-memory filesystem with TTL ──────────────────────────────────────────

interface FilesystemEntry {
  files: Map<string, string>;
  lastAccessedAt: number;
  ttlTimer: ReturnType<typeof setTimeout>;
}

const filesystems = new Map<string, FilesystemEntry>();

function touchFilesystem(codespaceId: string): void {
  const entry = filesystems.get(codespaceId);
  if (!entry) return;
  entry.lastAccessedAt = Date.now();
  clearTimeout(entry.ttlTimer);
  entry.ttlTimer = setTimeout(() => {
    filesystems.delete(codespaceId);
  }, DEFAULT_TTL_MS);
}

export function getFilesystem(codespaceId: string): Map<string, string> {
  let entry = filesystems.get(codespaceId);
  if (!entry) {
    entry = {
      files: new Map<string, string>(),
      lastAccessedAt: Date.now(),
      ttlTimer: setTimeout(() => {
        filesystems.delete(codespaceId);
      }, DEFAULT_TTL_MS),
    };
    filesystems.set(codespaceId, entry);
  } else {
    touchFilesystem(codespaceId);
  }
  return entry.files;
}

function getExistingFiles(codespaceId: string): Map<string, string> | undefined {
  const entry = filesystems.get(codespaceId);
  if (entry) {
    touchFilesystem(codespaceId);
    return entry.files;
  }
  return undefined;
}

export function _resetFilesystems(): void {
  for (const entry of filesystems.values()) {
    clearTimeout(entry.ttlTimer);
  }
  filesystems.clear();
}

// ── Filesystem helpers ─────────────────────────────────────────────────────

function normalizePath(path: string): string {
  if (!path.startsWith("/")) return `/${path}`;
  return path;
}

function totalSizeBytes(fs: Map<string, string>): number {
  let total = 0;
  for (const content of fs.values()) {
    total += new TextEncoder().encode(content).byteLength;
  }
  return total;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function globToRegex(pattern: string): RegExp {
  const normalized = pattern.startsWith("/") ? pattern : `/${pattern}`;
  let regex = "";
  let i = 0;
  while (i < normalized.length) {
    const char = normalized[i]!;
    if (char === "*" && normalized[i + 1] === "*") {
      if (normalized[i + 2] === "/") {
        regex += "(?:.*/)?";
        i += 3;
      } else {
        regex += ".*";
        i += 2;
      }
    } else if (char === "*") {
      regex += "[^/]*";
      i++;
    } else if (char === "?") {
      regex += "[^/]";
      i++;
    } else if (".+^${}()|[]\\".includes(char)) {
      regex += `\\${char}`;
      i++;
    } else {
      regex += char;
      i++;
    }
  }
  return new RegExp(`^${regex}$`);
}

function matchGlob(pattern: string, filePath: string): boolean {
  const re = globToRegex(pattern);
  return re.test(filePath);
}

// ── Template catalog ───────────────────────────────────────────────────────

interface TemplateFile {
  path: string;
  content: string;
}

interface Template {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  fileCount: number;
  dependencies: Array<{ name: string; version: string; dev: boolean }>;
  files: TemplateFile[];
}

type TemplateCategory = "react" | "next" | "dashboard" | "game" | "utility" | "blank";

interface ParsedDependency {
  name: string;
  version: string;
  type: "dependency" | "devDependency";
}

const TEMPLATES: Template[] = [
  {
    id: "blank",
    name: "Blank",
    description: "Empty React component — a clean slate.",
    category: "blank",
    fileCount: 1,
    dependencies: [],
    files: [
      {
        path: "/src/App.tsx",
        content: `import React from "react";\n\nexport default function App() {\n  return (\n    <div style={{ padding: 24 }}>\n      <h1>Hello World</h1>\n    </div>\n  );\n}\n`,
      },
    ],
  },
  {
    id: "react-counter",
    name: "React Counter",
    description: "Simple counter demonstrating useState and event handlers.",
    category: "react",
    fileCount: 1,
    dependencies: [],
    files: [
      {
        path: "/src/App.tsx",
        content: `import React, { useState } from "react";\n\nexport default function App() {\n  const [count, setCount] = useState(0);\n  return (\n    <div style={{ padding: 24 }}>\n      <h1>Count: {count}</h1>\n      <button onClick={() => setCount(c => c + 1)}>Increment</button>\n      <button onClick={() => setCount(c => c - 1)}>Decrement</button>\n      <button onClick={() => setCount(0)}>Reset</button>\n    </div>\n  );\n}\n`,
      },
    ],
  },
  {
    id: "react-fetch",
    name: "React Data Fetcher",
    description: "Fetches data from an API with loading and error states.",
    category: "react",
    fileCount: 1,
    dependencies: [],
    files: [
      {
        path: "/src/App.tsx",
        content: `import React, { useState, useEffect } from "react";\n\ninterface Post {\n  id: number;\n  title: string;\n  body: string;\n}\n\nexport default function App() {\n  const [posts, setPosts] = useState<Post[]>([]);\n  const [loading, setLoading] = useState(true);\n  const [error, setError] = useState<string | null>(null);\n\n  useEffect(() => {\n    fetch("https://jsonplaceholder.typicode.com/posts?_limit=5")\n      .then(r => r.json())\n      .then((data: Post[]) => { setPosts(data); setLoading(false); })\n      .catch(e => { setError(String(e)); setLoading(false); });\n  }, []);\n\n  if (loading) return <p>Loading...</p>;\n  if (error) return <p>Error: {error}</p>;\n  return (\n    <ul>{posts.map(p => <li key={p.id}><strong>{p.title}</strong></li>)}</ul>\n  );\n}\n`,
      },
    ],
  },
  {
    id: "dashboard-stats",
    name: "Stats Dashboard",
    description: "Grid of KPI cards with sparkline placeholders.",
    category: "dashboard",
    fileCount: 2,
    dependencies: [{ name: "recharts", version: "^2.12.0", dev: false }],
    files: [
      {
        path: "/src/App.tsx",
        content: `import React from "react";\nimport StatCard from "./StatCard";\n\nexport default function App() {\n  return (\n    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, padding: 24 }}>\n      <StatCard label="Users" value="12,400" delta="+8%" />\n      <StatCard label="Revenue" value="$48,200" delta="+3%" />\n      <StatCard label="Requests" value="1.2M" delta="-2%" />\n    </div>\n  );\n}\n`,
      },
      {
        path: "/src/StatCard.tsx",
        content: `import React from "react";\n\ninterface Props { label: string; value: string; delta: string; }\n\nexport default function StatCard({ label, value, delta }: Props) {\n  const positive = delta.startsWith("+");\n  return (\n    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 16 }}>\n      <p style={{ fontSize: 12, color: "#6b7280" }}>{label}</p>\n      <p style={{ fontSize: 28, fontWeight: 700 }}>{value}</p>\n      <p style={{ color: positive ? "#16a34a" : "#dc2626" }}>{delta}</p>\n    </div>\n  );\n}\n`,
      },
    ],
  },
  {
    id: "dashboard-table",
    name: "Data Table Dashboard",
    description: "Sortable table with pagination for tabular data.",
    category: "dashboard",
    fileCount: 1,
    dependencies: [],
    files: [
      {
        path: "/src/App.tsx",
        content: `import React, { useState } from "react";\n\nconst DATA = Array.from({ length: 20 }, (_, i) => ({\n  id: i + 1,\n  name: \`Item \${i + 1}\`,\n  value: Math.round(Math.random() * 1000),\n}));\n\nexport default function App() {\n  const [page, setPage] = useState(0);\n  const PAGE_SIZE = 5;\n  const rows = DATA.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);\n  return (\n    <div style={{ padding: 24 }}>\n      <table style={{ width: "100%", borderCollapse: "collapse" }}>\n        <thead>\n          <tr>{["ID","Name","Value"].map(h => <th key={h} style={{ textAlign: "left", borderBottom: "2px solid #e5e7eb", paddingBottom: 8 }}>{h}</th>)}</tr>\n        </thead>\n        <tbody>\n          {rows.map(r => <tr key={r.id}><td>{r.id}</td><td>{r.name}</td><td>{r.value}</td></tr>)}\n        </tbody>\n      </table>\n      <div style={{ marginTop: 12 }}>\n        <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>Prev</button>\n        <span style={{ margin: "0 8px" }}>Page {page + 1}</span>\n        <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * PAGE_SIZE >= DATA.length}>Next</button>\n      </div>\n    </div>\n  );\n}\n`,
      },
    ],
  },
  {
    id: "game-snake",
    name: "Snake Game",
    description: "Classic snake game using canvas and keyboard controls.",
    category: "game",
    fileCount: 1,
    dependencies: [],
    files: [
      {
        path: "/src/App.tsx",
        content: `import React, { useEffect, useRef, useState } from "react";\n\nconst CELL = 20;\nconst W = 20;\nconst H = 20;\n\nexport default function App() {\n  const canvasRef = useRef<HTMLCanvasElement>(null);\n  const [score, setScore] = useState(0);\n  const [gameOver, setGameOver] = useState(false);\n\n  useEffect(() => {\n    const canvas = canvasRef.current;\n    if (!canvas) return;\n    const ctx = canvas.getContext("2d")!;\n    let snake = [{ x: 10, y: 10 }];\n    let dir = { x: 1, y: 0 };\n    let food = { x: 5, y: 5 };\n    let sc = 0;\n\n    const onKey = (e: KeyboardEvent) => {\n      if (e.key === "ArrowUp" && dir.y === 0) dir = { x: 0, y: -1 };\n      if (e.key === "ArrowDown" && dir.y === 0) dir = { x: 0, y: 1 };\n      if (e.key === "ArrowLeft" && dir.x === 0) dir = { x: -1, y: 0 };\n      if (e.key === "ArrowRight" && dir.x === 0) dir = { x: 1, y: 0 };\n    };\n    window.addEventListener("keydown", onKey);\n\n    const tick = setInterval(() => {\n      const head = { x: (snake[0]!.x + dir.x + W) % W, y: (snake[0]!.y + dir.y + H) % H };\n      if (snake.some(s => s.x === head.x && s.y === head.y)) {\n        clearInterval(tick);\n        setGameOver(true);\n        return;\n      }\n      snake = [head, ...snake];\n      if (head.x === food.x && head.y === food.y) {\n        food = { x: Math.floor(Math.random() * W), y: Math.floor(Math.random() * H) };\n        sc++;\n        setScore(sc);\n      } else {\n        snake.pop();\n      }\n      ctx.fillStyle = "#111";\n      ctx.fillRect(0, 0, W * CELL, H * CELL);\n      ctx.fillStyle = "#22c55e";\n      snake.forEach(s => ctx.fillRect(s.x * CELL, s.y * CELL, CELL - 1, CELL - 1));\n      ctx.fillStyle = "#ef4444";\n      ctx.fillRect(food.x * CELL, food.y * CELL, CELL - 1, CELL - 1);\n    }, 150);\n\n    return () => { clearInterval(tick); window.removeEventListener("keydown", onKey); };\n  }, []);\n\n  return (\n    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 24 }}>\n      <h1>Snake — Score: {score}</h1>\n      {gameOver && <p style={{ color: "red" }}>Game Over!</p>}\n      <canvas ref={canvasRef} width={W * CELL} height={H * CELL} style={{ border: "1px solid #333" }} />\n      <p style={{ marginTop: 8, color: "#6b7280" }}>Use arrow keys to move</p>\n    </div>\n  );\n}\n`,
      },
    ],
  },
  {
    id: "utility-color-picker",
    name: "Color Picker",
    description: "Interactive HSL color picker with hex preview.",
    category: "utility",
    fileCount: 1,
    dependencies: [],
    files: [
      {
        path: "/src/App.tsx",
        content: `import React, { useState } from "react";\n\nfunction hslToHex(h: number, s: number, l: number): string {\n  s /= 100; l /= 100;\n  const a = s * Math.min(l, 1 - l);\n  const f = (n: number) => {\n    const k = (n + h / 30) % 12;\n    const color = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));\n    return Math.round(255 * color).toString(16).padStart(2, "0");\n  };\n  return \`#\${f(0)}\${f(8)}\${f(4)}\`;\n}\n\nexport default function App() {\n  const [h, setH] = useState(200);\n  const [s, setS] = useState(80);\n  const [l, setL] = useState(50);\n  const hex = hslToHex(h, s, l);\n  const bg = \`hsl(\${h},\${s}%,\${l}%)\`;\n  return (\n    <div style={{ padding: 24, maxWidth: 320 }}>\n      <div style={{ height: 80, borderRadius: 8, background: bg, marginBottom: 16 }} />\n      <p><strong>Hex:</strong> {hex}</p>\n      {[["H", h, setH, 360], ["S", s, setS, 100], ["L", l, setL, 100]].map(([label, val, setter, max]) => (\n        <label key={String(label)} style={{ display: "block", marginBottom: 8 }}>\n          {String(label)}: {String(val)}\n          <input type="range" min={0} max={Number(max)} value={Number(val)}\n            onChange={e => (setter as (v: number) => void)(Number(e.target.value))}\n            style={{ width: "100%", display: "block" }} />\n        </label>\n      ))}\n    </div>\n  );\n}\n`,
      },
    ],
  },
  {
    id: "next-api-route",
    name: "Next.js API Route",
    description: "Next.js App Router API route with GET/POST handlers.",
    category: "next",
    fileCount: 2,
    dependencies: [
      { name: "next", version: "^15.0.0", dev: false },
      { name: "@types/node", version: "^20.0.0", dev: true },
    ],
    files: [
      {
        path: "/src/app/api/hello/route.ts",
        content: `import { NextRequest, NextResponse } from "next/server";\n\nexport async function GET() {\n  return NextResponse.json({ message: "Hello, World!", time: new Date().toISOString() });\n}\n\nexport async function POST(request: NextRequest) {\n  const body = await request.json();\n  return NextResponse.json({ received: body, time: new Date().toISOString() });\n}\n`,
      },
      {
        path: "/src/App.tsx",
        content: `import React from "react";\n\nexport default function App() {\n  return (\n    <div style={{ padding: 24 }}>\n      <h1>Next.js API Route Template</h1>\n      <p>API route at <code>/api/hello</code> — supports GET and POST.</p>\n    </div>\n  );\n}\n`,
      },
    ],
  },
];

function parseDependenciesFromCode(code: string): ParsedDependency[] {
  const deps: ParsedDependency[] = [];
  const importRegex = /^import\s+(?:[^'"]+\s+from\s+)?['"]([^'"./][^'"]*)['"]/gm;
  const requireRegex = /require\s*\(\s*['"]([^'"./][^'"]*)['"]\s*\)/g;

  const seen = new Set<string>();

  for (const re of [importRegex, requireRegex]) {
    let match: RegExpExecArray | null;
    while ((match = re.exec(code)) !== null) {
      const raw = match[1];
      if (!raw) continue;
      const parts = raw.startsWith("@") ? raw.split("/").slice(0, 2) : [raw.split("/")[0]!];
      const pkgName = parts.join("/");
      if (!pkgName || seen.has(pkgName)) continue;
      seen.add(pkgName);
      deps.push({ name: pkgName, version: "latest", type: "dependency" });
    }
  }

  return deps;
}

// ── Zod schemas ────────────────────────────────────────────────────────────

const CodeSpaceIdZ = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_.-]+$/);

// ── Tool definitions ───────────────────────────────────────────────────────

export const codespaceTools: StandaloneToolDefinition[] = [
  // ══════════════════════════════════════════════════════════════════════════
  // Codespace core tools
  // ══════════════════════════════════════════════════════════════════════════
  {
    name: "codespace_update",
    description: `Create or update a live React application.\nThe app is available at: ${SPIKE_LAND_BASE_URL}/api/codespace/{codespace_id}/embed`,
    category: "codespace",
    tier: "free",
    inputSchema: {
      codespace_id: CodeSpaceIdZ,
      code: z.string().min(1),
      run: z.boolean().optional().default(true),
    },
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> => {
      const { codespace_id, code, run } = input as {
        codespace_id: string;
        code: string;
        run?: boolean;
      };
      validateCodeSpaceId(codespace_id);
      try {
        const { getOrCreateSession, upsertSession } = await import(
          "@/lib/codespace/session-service"
        );
        const { transpileCode } = await import("@/lib/codespace/transpile");
        const session = await getOrCreateSession(codespace_id);
        let transpiled = session.transpiled;
        if (run !== false) {
          transpiled = await transpileCode(code, SPIKE_LAND_BASE_URL);
        }
        const updated = await upsertSession({
          ...session,
          codeSpace: codespace_id,
          code,
          transpiled,
          messages: session.messages ?? [],
        });
        return {
          content: [
            {
              type: "text",
              text: `**CodeSpace Updated!**\n\n**ID:** ${updated.codeSpace}\n**Hash:** ${updated.hash}\n**Live URL:** ${SPIKE_LAND_BASE_URL}/api/codespace/${codespace_id}/embed`,
            },
          ],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return {
          content: [{ type: "text", text: `Error: ${msg}` }],
          isError: true,
        };
      }
    },
  },

  {
    name: "codespace_run",
    description: "Transpile and render a codespace without updating code.",
    category: "codespace",
    tier: "free",
    inputSchema: {
      codespace_id: CodeSpaceIdZ,
    },
    handler: async (input: never): Promise<CallToolResult> => {
      const { codespace_id } = input as { codespace_id: string };
      validateCodeSpaceId(codespace_id);
      try {
        const { getSession, upsertSession } = await import("@/lib/codespace/session-service");
        const { transpileCode } = await import("@/lib/codespace/transpile");
        const session = await getSession(codespace_id);
        if (!session) {
          return {
            content: [
              {
                type: "text",
                text: `Error: Codespace "${codespace_id}" not found`,
              },
            ],
            isError: true,
          };
        }
        const transpiled = await transpileCode(session.code, SPIKE_LAND_BASE_URL);
        const updated = await upsertSession({ ...session, transpiled });
        return {
          content: [
            {
              type: "text",
              text: `**Transpiled!**\n\n**ID:** ${updated.codeSpace}\n**Hash:** ${updated.hash}\n**Live URL:** ${SPIKE_LAND_BASE_URL}/api/codespace/${codespace_id}/embed`,
            },
          ],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return {
          content: [{ type: "text", text: `Error: ${msg}` }],
          isError: true,
        };
      }
    },
  },

  {
    name: "codespace_screenshot",
    description: "Get a JPEG screenshot of a running codespace.",
    category: "codespace",
    tier: "free",
    inputSchema: {
      codespace_id: CodeSpaceIdZ,
    },
    handler: async (input: never): Promise<CallToolResult> => {
      const { codespace_id } = input as { codespace_id: string };
      validateCodeSpaceId(codespace_id);
      const screenshotUrl = `${COMPONENT_URL}/live/${codespace_id}/api/screenshot`;
      try {
        const response = await fetch(screenshotUrl);
        if (!response.ok) {
          return {
            content: [
              {
                type: "text",
                text: `Error: Screenshot unavailable (${response.status})`,
              },
            ],
            isError: true,
          };
        }
        const buf = await response.arrayBuffer();
        return {
          content: [
            {
              type: "text",
              text: `**Screenshot of ${codespace_id}**\nLive URL: ${SPIKE_LAND_BASE_URL}/api/codespace/${codespace_id}/embed`,
            },
            {
              type: "image",
              data: Buffer.from(buf).toString("base64"),
              mimeType: "image/jpeg",
            },
          ],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return {
          content: [{ type: "text", text: `Error: ${msg}` }],
          isError: true,
        };
      }
    },
  },

  {
    name: "codespace_get",
    description: "Get the current code and session data for a codespace.",
    category: "codespace",
    tier: "free",
    inputSchema: {
      codespace_id: CodeSpaceIdZ,
    },
    handler: async (input: never): Promise<CallToolResult> => {
      const { codespace_id } = input as { codespace_id: string };
      validateCodeSpaceId(codespace_id);
      try {
        const { getSession } = await import("@/lib/codespace/session-service");
        const session = await getSession(codespace_id);
        if (!session) {
          return {
            content: [
              {
                type: "text",
                text: `Error: Codespace "${codespace_id}" not found`,
              },
            ],
            isError: true,
          };
        }
        let text = `**CodeSpace Details**\n\n**ID:** ${session.codeSpace}\n**Hash:** ${session.hash}\n**Live URL:** ${SPIKE_LAND_BASE_URL}/api/codespace/${codespace_id}/embed\n`;
        text += `\n**Source Code:**\n\`\`\`tsx\n${session.code}\n\`\`\``;
        return { content: [{ type: "text", text }] };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return {
          content: [{ type: "text", text: `Error: ${msg}` }],
          isError: true,
        };
      }
    },
  },

  {
    name: "codespace_link_app",
    description: "Link a codespace to the user's apps on spike.land.",
    category: "codespace",
    tier: "free",
    inputSchema: {
      codespace_id: CodeSpaceIdZ,
      app_id: z.string().optional(),
      app_name: z.string().min(3).max(50).optional(),
      app_description: z.string().min(10).max(500).optional(),
    },
    handler: async (input: never, ctx: ServerContext): Promise<CallToolResult> => {
      const { codespace_id, app_id, app_name, app_description } = input as {
        codespace_id: string;
        app_id?: string;
        app_name?: string;
        app_description?: string;
      };
      const serviceToken = ctx.env.SPIKE_LAND_SERVICE_TOKEN || ctx.env.SPIKE_LAND_API_KEY || "";

      if (app_id) {
        const result = await spikeLandRequest<{ id: string; name: string }>(
          `/api/apps/${app_id}`,
          serviceToken,
          {
            method: "PATCH",
            body: JSON.stringify({ codespaceId: codespace_id }),
          },
        );
        if (result.error) {
          return errorResult(`Error: ${result.error}`);
        }
        return textResult(`**Linked!** App ${result.data?.name} → codespace ${codespace_id}`);
      }
      if (!app_name) {
        return errorResult("Either app_id or app_name required");
      }
      const result = await spikeLandRequest<{ id: string; name: string }>(
        "/api/apps",
        serviceToken,
        {
          method: "POST",
          body: JSON.stringify({
            name: app_name,
            description: app_description || `App from codespace ${codespace_id}`,
            requirements: "Codespace-based app",
            monetizationModel: "free",
            codespaceId: codespace_id,
          }),
        },
      );
      if (result.error) {
        return errorResult(`Error: ${result.error}`);
      }
      return textResult(
        `**App Created!** ${result.data?.name} → codespace ${codespace_id}\nView: https://spike.land/create`,
      );
    },
  },

  {
    name: "codespace_list_my_apps",
    description: "List the user's apps from spike.land.",
    category: "codespace",
    tier: "free",
    inputSchema: {},
    handler: async (_input: never, ctx: ServerContext): Promise<CallToolResult> => {
      const serviceToken = ctx.env.SPIKE_LAND_SERVICE_TOKEN || ctx.env.SPIKE_LAND_API_KEY || "";
      const result = await spikeLandRequest<
        Array<{
          id: string;
          name: string;
          status: string;
          codespaceId?: string;
          codespaceUrl?: string;
        }>
      >("/api/apps", serviceToken);
      if (result.error) {
        return errorResult(`Error: ${result.error}`);
      }
      const apps = result.data || [];
      let text = `**My Apps (${apps.length}):**\n\n`;
      if (apps.length === 0) text += "No apps found.";
      else {
        for (const app of apps) {
          text += `- **${app.name}** (${app.status}) ID: ${app.id}\n`;
          if (app.codespaceId) text += `  Codespace: ${app.codespaceId}\n`;
        }
      }
      return { content: [{ type: "text", text }] };
    },
  },

  {
    name: "codespace_run_tests",
    description:
      "Discover and validate test files in a codespace filesystem.\nReturns inventory of test files found.",
    category: "codespace",
    tier: "free",
    inputSchema: {
      codespace_id: CodeSpaceIdZ,
      test_path: z.string().optional().describe("Specific test file path, or omit to find all"),
    },
    handler: async (input: never): Promise<CallToolResult> => {
      const { codespace_id, test_path } = input as {
        codespace_id: string;
        test_path?: string;
      };
      validateCodeSpaceId(codespace_id);
      const fs = getFilesystem(codespace_id);

      if (fs.size === 0) {
        return errorResult(
          `No files in codespace "${codespace_id}". Use fs_write to add files first.`,
        );
      }

      const testFiles: string[] = [];
      for (const path of fs.keys()) {
        if (test_path) {
          const normalized = path.startsWith("/") ? path : `/${path}`;
          const normalizedTarget = test_path.startsWith("/") ? test_path : `/${test_path}`;
          if (normalized === normalizedTarget) {
            testFiles.push(path);
          }
        } else if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(path)) {
          testFiles.push(path);
        }
      }

      if (testFiles.length === 0) {
        return errorResult(
          `No test files found in codespace "${codespace_id}".${
            test_path ? ` Looked for: ${test_path}` : ""
          }`,
        );
      }

      const details = testFiles.map((p) => {
        const content = fs.get(p) || "";
        const lines = content.split("\n").length;
        return `- **${p}** (${lines} lines)`;
      });

      return textResult(
        `**Test files (${testFiles.length}):**\n\n${details.join(
          "\n",
        )}\n\n_MVP: Test execution coming soon. Files are syntactically present._`,
      );
    },
  },

  {
    name: "codespace_generate_variant",
    description:
      "Generate code variants from tests and spec.\nMVP: Returns stub variant IDs. Full AI generation coming soon.",
    category: "codespace",
    tier: "free",
    inputSchema: {
      codespace_id: CodeSpaceIdZ,
      spec: z.string().optional().describe("Natural language spec for generation"),
      count: z.number().int().min(1).max(10).optional().default(3).describe("Number of variants"),
      model: z.string().optional().default("claude-sonnet-4-6").describe("AI model to use"),
    },
    handler: async (input: never): Promise<CallToolResult> => {
      const { codespace_id, spec, count } = input as {
        codespace_id: string;
        spec?: string;
        count?: number;
      };
      validateCodeSpaceId(codespace_id);
      const fs = getFilesystem(codespace_id);
      const variantCount = count ?? 3;

      const testFiles: string[] = [];
      for (const path of fs.keys()) {
        if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(path)) {
          testFiles.push(path);
        }
      }

      const entryPoint = fs.get("/src/App.tsx");
      const variants = Array.from({ length: variantCount }, (_, i) => `${codespace_id}-v${i + 1}`);

      let text = `**Generation request accepted**\n\n`;
      text += `- **Base codespace:** ${codespace_id}\n`;
      text += `- **Test files:** ${testFiles.length > 0 ? testFiles.join(", ") : "none"}\n`;
      text += `- **Entry point:** ${entryPoint ? "found" : "missing"}\n`;
      text += `- **Spec:** ${spec || "(none)"}\n`;
      text += `- **Variants:** ${variants.join(", ")}\n\n`;
      text += `_MVP: Variant IDs reserved. Full AI generation coming soon._`;

      return { content: [{ type: "text", text }] };
    },
  },

  {
    name: "codespace_regenerate",
    description:
      "Regenerate codespace code from tests or restore from version.\nDefault: regenerates from tests if they exist.",
    category: "codespace",
    tier: "free",
    inputSchema: {
      codespace_id: CodeSpaceIdZ,
      from_tests: z.boolean().optional().describe("Regenerate from test files"),
      from_version: z.number().int().optional().describe("Restore from version number"),
    },
    handler: async (input: never): Promise<CallToolResult> => {
      const { codespace_id, from_tests, from_version } = input as {
        codespace_id: string;
        from_tests?: boolean;
        from_version?: number;
      };
      validateCodeSpaceId(codespace_id);
      const fs = getFilesystem(codespace_id);

      if (from_version !== undefined) {
        return textResult(
          `**Version restore requested**\n\n- **Codespace:** ${codespace_id}\n- **Version:** ${from_version}\n\n_MVP: Version restore coming soon._`,
        );
      }

      const testFiles: string[] = [];
      for (const path of fs.keys()) {
        if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(path)) {
          testFiles.push(path);
        }
      }

      if (testFiles.length === 0 && (from_tests === true || from_tests === undefined)) {
        return errorResult(
          `No test files found in codespace "${codespace_id}". Write tests first with fs_write.`,
        );
      }

      let text = `**Regeneration request accepted**\n\n`;
      text += `- **Codespace:** ${codespace_id}\n`;
      text += `- **Strategy:** ${from_tests ? "from tests" : "auto (tests found)"}\n`;
      text += `- **Test files:** ${testFiles.join(", ")}\n\n`;
      text += `_MVP: Regeneration coming soon. Test files identified._`;

      return textResult(text);
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // Filesystem tools
  // ══════════════════════════════════════════════════════════════════════════
  {
    name: "fs_read",
    description:
      "Read a file from the codespace virtual filesystem.\n" +
      "Returns content with line numbers (cat -n style).\n" +
      "Use offset/limit for large files.",
    category: "filesystem",
    tier: "free",
    inputSchema: {
      codespace_id: CodeSpaceIdZ,
      file_path: z.string().min(1).describe("Absolute path e.g. /src/App.tsx"),
      offset: z.number().int().min(1).optional().describe("Start from line number (1-based)"),
      limit: z.number().int().min(1).optional().describe("Number of lines to return"),
    },
    handler: async (input: never): Promise<CallToolResult> =>
      safeToolCall("fs_read", async () => {
        const { codespace_id, file_path, offset, limit } = input as {
          codespace_id: string;
          file_path: string;
          offset?: number;
          limit?: number;
        };
        validateCodeSpaceId(codespace_id);
        const fs = getExistingFiles(codespace_id);
        const path = normalizePath(file_path);

        if (!fs || !fs.has(path)) {
          return errorResult(`File "${path}" not found in codespace "${codespace_id}".`);
        }

        const content = fs.get(path)!;
        let lines = content.split("\n");

        const startLine = offset ?? 1;
        const endLine = limit ? startLine + limit - 1 : lines.length;
        lines = lines.slice(startLine - 1, endLine);

        const numbered = lines
          .map((line, i) => {
            const lineNum = String(startLine + i).padStart(6, " ");
            return `${lineNum}\t${line}`;
          })
          .join("\n");

        return textResult(numbered);
      }),
  },

  {
    name: "fs_write",
    description:
      "Write or create a file in the codespace virtual filesystem.\n" +
      "Limits: 1MB per file, 100 files per codespace, 50MB total.",
    category: "filesystem",
    tier: "free",
    inputSchema: {
      codespace_id: CodeSpaceIdZ,
      file_path: z.string().min(1).describe("Absolute path e.g. /src/utils.ts"),
      content: z.string().describe("File content"),
    },
    handler: async (input: never): Promise<CallToolResult> =>
      safeToolCall("fs_write", async () => {
        const { codespace_id, file_path, content } = input as {
          codespace_id: string;
          file_path: string;
          content: string;
        };
        validateCodeSpaceId(codespace_id);
        const fs = getFilesystem(codespace_id);
        const path = normalizePath(file_path);
        const sizeBytes = new TextEncoder().encode(content).byteLength;

        if (sizeBytes > MAX_FILE_SIZE_BYTES) {
          return errorResult(`File exceeds 1MB limit (${sizeBytes} bytes).`);
        }
        if (fs.size >= MAX_FILE_COUNT && !fs.has(path)) {
          return errorResult(
            `File limit (${MAX_FILE_COUNT}) reached for codespace "${codespace_id}".`,
          );
        }
        const oldSize = fs.has(path) ? new TextEncoder().encode(fs.get(path)!).byteLength : 0;
        const newTotal = totalSizeBytes(fs) - oldSize + sizeBytes;
        if (newTotal > MAX_TOTAL_SIZE_BYTES) {
          return errorResult(`Total size limit (50MB) exceeded for codespace "${codespace_id}".`);
        }

        const isNew = !fs.has(path);
        fs.set(path, content);

        return textResult(
          `**File ${isNew ? "created" : "updated"}**\n\n` +
            `- **Path:** ${path}\n` +
            `- **Size:** ${sizeBytes} bytes\n` +
            `- **Total files:** ${fs.size}`,
        );
      }),
  },

  {
    name: "fs_edit",
    description:
      "Exact string replacement in a codespace file.\n" +
      "Fails if old_text is not found or appears more than once.",
    category: "filesystem",
    tier: "free",
    inputSchema: {
      codespace_id: CodeSpaceIdZ,
      file_path: z.string().min(1).describe("Absolute path"),
      old_text: z.string().min(1).describe("Exact text to find"),
      new_text: z.string().describe("Replacement text"),
    },
    handler: async (input: never): Promise<CallToolResult> =>
      safeToolCall("fs_edit", async () => {
        const { codespace_id, file_path, old_text, new_text } = input as {
          codespace_id: string;
          file_path: string;
          old_text: string;
          new_text: string;
        };
        validateCodeSpaceId(codespace_id);
        const fs = getExistingFiles(codespace_id);
        const path = normalizePath(file_path);

        if (!fs || !fs.has(path)) {
          return errorResult(`File "${path}" not found in codespace "${codespace_id}".`);
        }

        const content = fs.get(path)!;
        const firstIndex = content.indexOf(old_text);
        if (firstIndex === -1) {
          return errorResult(`old_text not found in "${path}".`);
        }
        const secondIndex = content.indexOf(old_text, firstIndex + 1);
        if (secondIndex !== -1) {
          return errorResult(
            `old_text appears multiple times in "${path}". Provide more context to make it unique.`,
          );
        }

        const updated = content.replace(old_text, new_text);
        fs.set(path, updated);

        const diffLines: string[] = [];
        for (const line of old_text.split("\n")) diffLines.push(`- ${line}`);
        for (const line of new_text.split("\n")) diffLines.push(`+ ${line}`);

        return textResult(
          `**File edited:** ${path}\n\n\`\`\`diff\n${diffLines.join("\n")}\n\`\`\``,
        );
      }),
  },

  {
    name: "fs_glob",
    description:
      "Find files by glob pattern in a codespace.\n" +
      "Supports ** (any path) and * (any name segment).",
    category: "filesystem",
    tier: "free",
    inputSchema: {
      codespace_id: CodeSpaceIdZ,
      pattern: z.string().min(1).describe("Glob pattern e.g. **/*.test.*"),
    },
    handler: async (input: never): Promise<CallToolResult> =>
      safeToolCall("fs_glob", async () => {
        const { codespace_id, pattern } = input as {
          codespace_id: string;
          pattern: string;
        };
        validateCodeSpaceId(codespace_id);
        const fs = getExistingFiles(codespace_id);

        if (!fs || fs.size === 0) {
          return textResult(`No files in codespace "${codespace_id}".`);
        }

        const matches: string[] = [];
        for (const filePath of fs.keys()) {
          if (matchGlob(pattern, filePath)) {
            matches.push(filePath);
          }
        }
        matches.sort();

        if (matches.length === 0) {
          return textResult(`No files matching "${pattern}" in codespace "${codespace_id}".`);
        }

        return textResult(
          `**${matches.length} file(s) matching \`${pattern}\`:**\n\n` +
            matches.map((p) => `- ${p}`).join("\n"),
        );
      }),
  },

  {
    name: "fs_grep",
    description:
      "Search file contents in a codespace.\n" + "Returns matched lines with file:line format.",
    category: "filesystem",
    tier: "free",
    inputSchema: {
      codespace_id: CodeSpaceIdZ,
      pattern: z.string().min(1).describe("Search pattern (string or regex)"),
      glob: z.string().optional().describe("Glob filter for files to search"),
      is_regex: z.boolean().optional().default(false).describe("Treat pattern as regex"),
      context: z
        .number()
        .int()
        .min(0)
        .max(10)
        .optional()
        .default(0)
        .describe("Context lines around match"),
    },
    handler: async (input: never): Promise<CallToolResult> =>
      safeToolCall("fs_grep", async () => {
        const { codespace_id, pattern, glob, is_regex, context } = input as {
          codespace_id: string;
          pattern: string;
          glob?: string;
          is_regex?: boolean;
          context?: number;
        };
        validateCodeSpaceId(codespace_id);
        const fs = getExistingFiles(codespace_id);

        if (!fs || fs.size === 0) {
          return textResult(`No files in codespace "${codespace_id}".`);
        }

        const ctx = context ?? 0;
        let re: RegExp;
        try {
          re = is_regex ? new RegExp(pattern) : new RegExp(escapeRegex(pattern));
        } catch {
          return errorResult(`Invalid regex pattern: "${pattern}"`);
        }

        const results: string[] = [];
        for (const [filePath, content] of fs.entries()) {
          if (glob && !matchGlob(glob, filePath)) continue;
          const lines = content.split("\n");
          for (let i = 0; i < lines.length; i++) {
            if (re.test(lines[i]!)) {
              if (ctx > 0) {
                const start = Math.max(0, i - ctx);
                const end = Math.min(lines.length - 1, i + ctx);
                for (let j = start; j <= end; j++) {
                  const prefix = j === i ? ">" : " ";
                  results.push(`${filePath}:${j + 1}:${prefix} ${lines[j]}`);
                }
                results.push("--");
              } else {
                results.push(`${filePath}:${i + 1}: ${lines[i]}`);
              }
            }
          }
        }

        if (results.length === 0) {
          return textResult(`No matches for "${pattern}" in codespace "${codespace_id}".`);
        }

        return textResult(results.join("\n"));
      }),
  },

  {
    name: "fs_ls",
    description:
      "List files and directories at a path in the codespace.\n" + "Defaults to root (/).",
    category: "filesystem",
    tier: "free",
    inputSchema: {
      codespace_id: CodeSpaceIdZ,
      path: z.string().optional().default("/").describe("Directory path to list"),
    },
    handler: async (input: never): Promise<CallToolResult> =>
      safeToolCall("fs_ls", async () => {
        const { codespace_id, path } = input as {
          codespace_id: string;
          path?: string;
        };
        validateCodeSpaceId(codespace_id);
        const fs = getExistingFiles(codespace_id);

        if (!fs || fs.size === 0) {
          return textResult(`No files in codespace "${codespace_id}".`);
        }

        const dirPath = normalizePath(path ?? "/");
        const prefix = dirPath === "/" ? "/" : `${dirPath}/`;
        const entries = new Set<string>();

        for (const filePath of fs.keys()) {
          if (dirPath === "/" || filePath.startsWith(prefix)) {
            const relative = dirPath === "/" ? filePath.slice(1) : filePath.slice(prefix.length);
            const firstSegment = relative.split("/")[0];
            if (firstSegment) {
              const isDir = relative.includes("/");
              entries.add(isDir ? `${firstSegment}/` : firstSegment);
            }
          }
        }

        const sorted = Array.from(entries).sort();
        if (sorted.length === 0) {
          return textResult(`No entries at "${dirPath}" in codespace "${codespace_id}".`);
        }

        return textResult(
          `**${dirPath}** (${sorted.length} entries):\n\n` + sorted.map((e) => `- ${e}`).join("\n"),
        );
      }),
  },

  {
    name: "fs_rm",
    description:
      "Remove a file from the codespace virtual filesystem.\n" +
      "The entry point /src/App.tsx is protected and cannot be removed.",
    category: "filesystem",
    tier: "free",
    inputSchema: {
      codespace_id: CodeSpaceIdZ,
      file_path: z.string().min(1).describe("Absolute path of file to remove"),
    },
    handler: async (input: never): Promise<CallToolResult> =>
      safeToolCall("fs_rm", async () => {
        const { codespace_id, file_path } = input as {
          codespace_id: string;
          file_path: string;
        };
        validateCodeSpaceId(codespace_id);
        const fs = getExistingFiles(codespace_id);
        const path = normalizePath(file_path);

        if (path === ENTRY_POINT) {
          return errorResult(`Cannot remove entry point "${ENTRY_POINT}". It is protected.`);
        }
        if (!fs || !fs.has(path)) {
          return errorResult(`File "${path}" not found in codespace "${codespace_id}".`);
        }

        fs.delete(path);
        return textResult(`**File removed:** ${path}\n**Remaining files:** ${fs.size}`);
      }),
  },

  {
    name: "fs_intent",
    description:
      "Declare agent mission and get relevant files proactively.\n" +
      "Analyzes mission text against file paths and contents,\n" +
      "returns a curated list of files the agent should read.",
    category: "filesystem",
    tier: "free",
    inputSchema: {
      codespace_id: CodeSpaceIdZ,
      mission: z.string().min(1).describe("What you intend to build or fix"),
      include_tests: z.boolean().optional().default(true).describe("Include test files in results"),
    },
    handler: async (input: never): Promise<CallToolResult> =>
      safeToolCall("fs_intent", async () => {
        const { codespace_id, mission, include_tests } = input as {
          codespace_id: string;
          mission: string;
          include_tests?: boolean;
        };
        validateCodeSpaceId(codespace_id);
        const fs = getExistingFiles(codespace_id);

        if (!fs || fs.size === 0) {
          return textResult(
            `No files in codespace "${codespace_id}". Start by writing files with fs_write.`,
          );
        }

        const keywords = mission
          .toLowerCase()
          .split(/[\s,;.!?]+/)
          .filter((w) => w.length > 2);

        const scored: Array<{ path: string; score: number; reason: string }> = [];

        for (const [filePath, content] of fs.entries()) {
          const isTest = /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(filePath);
          if (isTest && !include_tests) continue;

          let score = 0;
          const reasons: string[] = [];
          const pathLower = filePath.toLowerCase();
          const contentLower = content.toLowerCase();

          for (const kw of keywords) {
            if (pathLower.includes(kw)) {
              score += 3;
              reasons.push(`path contains "${kw}"`);
            }
            if (contentLower.includes(kw)) {
              score += 1;
              reasons.push(`content contains "${kw}"`);
            }
          }

          if (filePath === ENTRY_POINT) {
            score += 5;
            reasons.push("entry point");
          }
          if (isTest && include_tests) {
            score += 2;
            reasons.push("test file");
          }

          if (score > 0) {
            scored.push({
              path: filePath,
              score,
              reason: [...new Set(reasons)].join(", "),
            });
          }
        }

        scored.sort((a, b) => b.score - a.score);
        const top = scored.slice(0, 20);

        if (top.length === 0) {
          return textResult(
            `No files match mission "${mission}" in codespace "${codespace_id}".\n` +
              `Available files: ${Array.from(fs.keys()).join(", ")}`,
          );
        }

        const lines = top.map((f) => `- **${f.path}** (score: ${f.score}) — ${f.reason}`);

        return textResult(
          `**Mission:** ${mission}\n` +
            `**Relevant files (${top.length}):**\n\n` +
            lines.join("\n"),
        );
      }),
  },

  // ══════════════════════════════════════════════════════════════════════════
  // Template & dependency tools
  // ══════════════════════════════════════════════════════════════════════════
  {
    name: "codespace_list_templates",
    description:
      "Browse available project templates for codespace creation.\n" +
      "Optionally filter by category: react, next, dashboard, game, utility, blank.",
    category: "codespace-templates",
    tier: "free",
    inputSchema: {
      category: z.enum(["react", "next", "dashboard", "game", "utility", "blank"]).optional(),
    },
    handler: async (input: never): Promise<CallToolResult> =>
      safeToolCall("codespace_list_templates", async () => {
        const { category } = input as { category?: TemplateCategory };
        const filtered = category ? TEMPLATES.filter((t) => t.category === category) : TEMPLATES;

        if (filtered.length === 0) {
          return textResult(`No templates found for category "${String(category)}".`);
        }

        const lines = filtered.map(
          (t) =>
            `- **${t.id}** — ${t.name} (${t.category})\n` +
            `  ${t.description}\n` +
            `  Files: ${t.fileCount} | ` +
            `Dependencies: ${
              t.dependencies.length === 0 ? "none" : t.dependencies.map((d) => d.name).join(", ")
            }`,
        );

        return textResult(`**Available Templates (${filtered.length}):**\n\n${lines.join("\n\n")}`);
      }),
  },

  {
    name: "codespace_create_from_template",
    description:
      "Create a new codespace pre-populated from a project template.\n" +
      "Returns the new codespace ID, name, and list of files created.",
    category: "codespace-templates",
    tier: "free",
    inputSchema: {
      template_id: z.string().min(1),
      name: z
        .string()
        .min(1)
        .max(100)
        .regex(/^[a-zA-Z0-9_.-]+$/, {
          message: "Name must match /^[a-zA-Z0-9_.-]+$/",
        }),
      description: z.string().max(500).optional(),
    },
    handler: async (input: never): Promise<CallToolResult> =>
      safeToolCall("codespace_create_from_template", async () => {
        const { template_id, name, description } = input as {
          template_id: string;
          name: string;
          description?: string;
        };
        const template = TEMPLATES.find((t) => t.id === template_id);
        if (!template) {
          return errorResult(
            `Template "${template_id}" not found. Use codespace_list_templates to browse available templates.`,
          );
        }

        const entryFile =
          template.files.find((f) => f.path === "/src/App.tsx") ?? template.files[0];
        const entryCode = entryFile?.content ?? "export default function App() { return null; }";

        try {
          const { getOrCreateSession, upsertSession } = await import(
            "@/lib/codespace/session-service"
          );
          const session = await getOrCreateSession(name);
          await upsertSession({
            ...session,
            codeSpace: name,
            code: entryCode,
            transpiled: session.transpiled,
            messages: session.messages ?? [],
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          return errorResult(`Error creating codespace: ${msg}`);
        }

        const fileList = template.files.map((f) => `  - ${f.path}`).join("\n");
        const descLine = description
          ? `**Description:** ${description}\n`
          : `**Description:** ${template.description}\n`;

        return textResult(
          `**Codespace Created from Template!**\n\n` +
            `**ID:** ${name}\n` +
            `**Template:** ${template.name} (${template.id})\n` +
            descLine +
            `**Files created (${template.files.length}):**\n${fileList}\n` +
            (template.dependencies.length > 0
              ? `**Suggested dependencies:**\n${template.dependencies
                  .map((d) => `  - ${d.name}@${d.version}`)
                  .join("\n")}`
              : "**Dependencies:** none"),
        );
      }),
  },

  {
    name: "codespace_get_dependencies",
    description:
      "List npm dependencies inferred from a codespace's source code.\n" +
      "Parses import statements to detect external packages.",
    category: "codespace-templates",
    tier: "free",
    inputSchema: {
      codespace_id: CodeSpaceIdZ,
    },
    handler: async (input: never): Promise<CallToolResult> =>
      safeToolCall("codespace_get_dependencies", async () => {
        const { codespace_id } = input as { codespace_id: string };
        const { getSession } = await import("@/lib/codespace/session-service");
        const session = await getSession(codespace_id);

        if (!session) {
          return errorResult(`Codespace "${codespace_id}" not found.`);
        }

        const deps = parseDependenciesFromCode(session.code);
        const external = deps.filter((d) => d.name !== "react" && d.name !== "react-dom");

        if (external.length === 0) {
          return textResult(
            `**Dependencies for codespace "${codespace_id}":**\n\n` +
              `No external npm dependencies detected.\n` +
              `_(Built-ins like react and react-dom are always available.)_`,
          );
        }

        const lines = external.map((d) => `- **${d.name}** @ ${d.version} (${d.type})`);

        return textResult(
          `**Dependencies for codespace "${codespace_id}" (${external.length}):**\n\n` +
            lines.join("\n"),
        );
      }),
  },

  {
    name: "codespace_add_dependency",
    description:
      "Record an npm package dependency for a codespace.\n" +
      "Appends an import stub at the top of the entry point so the package\n" +
      "is visible to subsequent dependency scans.",
    category: "codespace-templates",
    tier: "free",
    inputSchema: {
      codespace_id: CodeSpaceIdZ,
      package_name: z.string().min(1).max(200),
      version: z.string().optional(),
      dev: z.boolean().optional().default(false),
    },
    handler: async (input: never): Promise<CallToolResult> =>
      safeToolCall("codespace_add_dependency", async () => {
        const { codespace_id, package_name, version, dev } = input as {
          codespace_id: string;
          package_name: string;
          version?: string;
          dev?: boolean;
        };
        const { getSession, upsertSession: upsert } = await import(
          "@/lib/codespace/session-service"
        );
        const session = await getSession(codespace_id);

        if (!session) {
          return errorResult(`Codespace "${codespace_id}" not found.`);
        }

        const resolvedVersion = version ?? "latest";
        const depType: "dependency" | "devDependency" = dev ? "devDependency" : "dependency";

        const stub = `// dependency: ${package_name}@${resolvedVersion} (${depType})\n`;
        const alreadyPresent =
          session.code.includes(`// dependency: ${package_name}`) ||
          new RegExp(`from ['"]${package_name}['"]`).test(session.code);

        if (!alreadyPresent) {
          const updatedCode = stub + session.code;
          await upsert({
            ...session,
            code: updatedCode,
            messages: session.messages ?? [],
          });
        }

        return textResult(
          `**Dependency added to codespace "${codespace_id}":**\n\n` +
            `- **Package:** ${package_name}\n` +
            `- **Version:** ${resolvedVersion}\n` +
            `- **Type:** ${depType}\n` +
            (alreadyPresent
              ? `\n_Package was already present — no changes made._`
              : `\n_Import stub recorded. Run codespace_update to apply._`),
        );
      }),
  },
];
