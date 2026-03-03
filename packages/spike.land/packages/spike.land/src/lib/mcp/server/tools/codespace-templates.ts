/**
 * CodeSpace Template & Dependency Tools
 *
 * Provides template browsing, template-based creation, and dependency
 * management for codespace projects.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";
import { getOrCreateSession, upsertSession } from "@/lib/codespace/session-service";

// ── Types ──────────────────────────────────────────────────────────────────

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
  dependencies: Array<{ name: string; version: string; dev: boolean; }>;
  files: TemplateFile[];
}

type TemplateCategory = "react" | "next" | "dashboard" | "game" | "utility" | "blank";

interface ParsedDependency {
  name: string;
  version: string;
  type: "dependency" | "devDependency";
}

// ── Hardcoded template catalog ─────────────────────────────────────────────

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
        content:
          `import React from "react";\n\nexport default function App() {\n  return (\n    <div style={{ padding: 24 }}>\n      <h1>Hello World</h1>\n    </div>\n  );\n}\n`,
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
        content:
          `import React, { useState } from "react";\n\nexport default function App() {\n  const [count, setCount] = useState(0);\n  return (\n    <div style={{ padding: 24 }}>\n      <h1>Count: {count}</h1>\n      <button onClick={() => setCount(c => c + 1)}>Increment</button>\n      <button onClick={() => setCount(c => c - 1)}>Decrement</button>\n      <button onClick={() => setCount(0)}>Reset</button>\n    </div>\n  );\n}\n`,
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
        content:
          `import React, { useState, useEffect } from "react";\n\ninterface Post {\n  id: number;\n  title: string;\n  body: string;\n}\n\nexport default function App() {\n  const [posts, setPosts] = useState<Post[]>([]);\n  const [loading, setLoading] = useState(true);\n  const [error, setError] = useState<string | null>(null);\n\n  useEffect(() => {\n    fetch("https://jsonplaceholder.typicode.com/posts?_limit=5")\n      .then(r => r.json())\n      .then((data: Post[]) => { setPosts(data); setLoading(false); })\n      .catch(e => { setError(String(e)); setLoading(false); });\n  }, []);\n\n  if (loading) return <p>Loading...</p>;\n  if (error) return <p>Error: {error}</p>;\n  return (\n    <ul>{posts.map(p => <li key={p.id}><strong>{p.title}</strong></li>)}</ul>\n  );\n}\n`,
      },
    ],
  },
  {
    id: "dashboard-stats",
    name: "Stats Dashboard",
    description: "Grid of KPI cards with sparkline placeholders.",
    category: "dashboard",
    fileCount: 2,
    dependencies: [
      { name: "recharts", version: "^2.12.0", dev: false },
    ],
    files: [
      {
        path: "/src/App.tsx",
        content:
          `import React from "react";\nimport StatCard from "./StatCard";\n\nexport default function App() {\n  return (\n    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, padding: 24 }}>\n      <StatCard label="Users" value="12,400" delta="+8%" />\n      <StatCard label="Revenue" value="$48,200" delta="+3%" />\n      <StatCard label="Requests" value="1.2M" delta="-2%" />\n    </div>\n  );\n}\n`,
      },
      {
        path: "/src/StatCard.tsx",
        content:
          `import React from "react";\n\ninterface Props { label: string; value: string; delta: string; }\n\nexport default function StatCard({ label, value, delta }: Props) {\n  const positive = delta.startsWith("+");\n  return (\n    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 16 }}>\n      <p style={{ fontSize: 12, color: "#6b7280" }}>{label}</p>\n      <p style={{ fontSize: 28, fontWeight: 700 }}>{value}</p>\n      <p style={{ color: positive ? "#16a34a" : "#dc2626" }}>{delta}</p>\n    </div>\n  );\n}\n`,
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
        content:
          `import React, { useState } from "react";\n\nconst DATA = Array.from({ length: 20 }, (_, i) => ({\n  id: i + 1,\n  name: \`Item \${i + 1}\`,\n  value: Math.round(Math.random() * 1000),\n}));\n\nexport default function App() {\n  const [page, setPage] = useState(0);\n  const PAGE_SIZE = 5;\n  const rows = DATA.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);\n  return (\n    <div style={{ padding: 24 }}>\n      <table style={{ width: "100%", borderCollapse: "collapse" }}>\n        <thead>\n          <tr>{["ID","Name","Value"].map(h => <th key={h} style={{ textAlign: "left", borderBottom: "2px solid #e5e7eb", paddingBottom: 8 }}>{h}</th>)}</tr>\n        </thead>\n        <tbody>\n          {rows.map(r => <tr key={r.id}><td>{r.id}</td><td>{r.name}</td><td>{r.value}</td></tr>)}\n        </tbody>\n      </table>\n      <div style={{ marginTop: 12 }}>\n        <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>Prev</button>\n        <span style={{ margin: "0 8px" }}>Page {page + 1}</span>\n        <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * PAGE_SIZE >= DATA.length}>Next</button>\n      </div>\n    </div>\n  );\n}\n`,
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
        content:
          `import React, { useEffect, useRef, useState } from "react";\n\nconst CELL = 20;\nconst W = 20;\nconst H = 20;\n\nexport default function App() {\n  const canvasRef = useRef<HTMLCanvasElement>(null);\n  const [score, setScore] = useState(0);\n  const [gameOver, setGameOver] = useState(false);\n\n  useEffect(() => {\n    const canvas = canvasRef.current;\n    if (!canvas) return;\n    const ctx = canvas.getContext("2d")!;\n    let snake = [{ x: 10, y: 10 }];\n    let dir = { x: 1, y: 0 };\n    let food = { x: 5, y: 5 };\n    let sc = 0;\n\n    const onKey = (e: KeyboardEvent) => {\n      if (e.key === "ArrowUp" && dir.y === 0) dir = { x: 0, y: -1 };\n      if (e.key === "ArrowDown" && dir.y === 0) dir = { x: 0, y: 1 };\n      if (e.key === "ArrowLeft" && dir.x === 0) dir = { x: -1, y: 0 };\n      if (e.key === "ArrowRight" && dir.x === 0) dir = { x: 1, y: 0 };\n    };\n    window.addEventListener("keydown", onKey);\n\n    const tick = setInterval(() => {\n      const head = { x: (snake[0]!.x + dir.x + W) % W, y: (snake[0]!.y + dir.y + H) % H };\n      if (snake.some(s => s.x === head.x && s.y === head.y)) {\n        clearInterval(tick);\n        setGameOver(true);\n        return;\n      }\n      snake = [head, ...snake];\n      if (head.x === food.x && head.y === food.y) {\n        food = { x: Math.floor(Math.random() * W), y: Math.floor(Math.random() * H) };\n        sc++;\n        setScore(sc);\n      } else {\n        snake.pop();\n      }\n      ctx.fillStyle = "#111";\n      ctx.fillRect(0, 0, W * CELL, H * CELL);\n      ctx.fillStyle = "#22c55e";\n      snake.forEach(s => ctx.fillRect(s.x * CELL, s.y * CELL, CELL - 1, CELL - 1));\n      ctx.fillStyle = "#ef4444";\n      ctx.fillRect(food.x * CELL, food.y * CELL, CELL - 1, CELL - 1);\n    }, 150);\n\n    return () => { clearInterval(tick); window.removeEventListener("keydown", onKey); };\n  }, []);\n\n  return (\n    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 24 }}>\n      <h1>Snake — Score: {score}</h1>\n      {gameOver && <p style={{ color: "red" }}>Game Over!</p>}\n      <canvas ref={canvasRef} width={W * CELL} height={H * CELL} style={{ border: "1px solid #333" }} />\n      <p style={{ marginTop: 8, color: "#6b7280" }}>Use arrow keys to move</p>\n    </div>\n  );\n}\n`,
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
        content:
          `import React, { useState } from "react";\n\nfunction hslToHex(h: number, s: number, l: number): string {\n  s /= 100; l /= 100;\n  const a = s * Math.min(l, 1 - l);\n  const f = (n: number) => {\n    const k = (n + h / 30) % 12;\n    const color = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));\n    return Math.round(255 * color).toString(16).padStart(2, "0");\n  };\n  return \`#\${f(0)}\${f(8)}\${f(4)}\`;\n}\n\nexport default function App() {\n  const [h, setH] = useState(200);\n  const [s, setS] = useState(80);\n  const [l, setL] = useState(50);\n  const hex = hslToHex(h, s, l);\n  const bg = \`hsl(\${h},\${s}%,\${l}%)\`;\n  return (\n    <div style={{ padding: 24, maxWidth: 320 }}>\n      <div style={{ height: 80, borderRadius: 8, background: bg, marginBottom: 16 }} />\n      <p><strong>Hex:</strong> {hex}</p>\n      {[["H", h, setH, 360], ["S", s, setS, 100], ["L", l, setL, 100]].map(([label, val, setter, max]) => (\n        <label key={String(label)} style={{ display: "block", marginBottom: 8 }}>\n          {String(label)}: {String(val)}\n          <input type="range" min={0} max={Number(max)} value={Number(val)}\n            onChange={e => (setter as (v: number) => void)(Number(e.target.value))}\n            style={{ width: "100%", display: "block" }} />\n        </label>\n      ))}\n    </div>\n  );\n}\n`,
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
        content:
          `import { NextRequest, NextResponse } from "next/server";\n\nexport async function GET() {\n  return NextResponse.json({ message: "Hello, World!", time: new Date().toISOString() });\n}\n\nexport async function POST(request: NextRequest) {\n  const body = await request.json();\n  return NextResponse.json({ received: body, time: new Date().toISOString() });\n}\n`,
      },
      {
        path: "/src/App.tsx",
        content:
          `import React from "react";\n\nexport default function App() {\n  return (\n    <div style={{ padding: 24 }}>\n      <h1>Next.js API Route Template</h1>\n      <p>API route at <code>/api/hello</code> — supports GET and POST.</p>\n    </div>\n  );\n}\n`,
      },
    ],
  },
];

// ── Dependency parsing helpers ─────────────────────────────────────────────

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
      // Normalize scoped packages: @scope/pkg/sub -> @scope/pkg
      const parts = raw.startsWith("@") ? raw.split("/").slice(0, 2) : [raw.split("/")[0]!];
      const pkgName = parts.join("/");
      if (!pkgName || seen.has(pkgName)) continue;
      seen.add(pkgName);
      deps.push({ name: pkgName, version: "latest", type: "dependency" });
    }
  }

  return deps;
}

// ── Schemas ────────────────────────────────────────────────────────────────

const ListTemplatesSchema = z.object({
  category: z.enum(["react", "next", "dashboard", "game", "utility", "blank"]).optional(),
});

const CreateFromTemplateSchema = z.object({
  template_id: z.string().min(1),
  name: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/, {
    message: "Name must match /^[a-zA-Z0-9_.-]+$/",
  }),
  description: z.string().max(500).optional(),
});

const GetDependenciesSchema = z.object({
  codespace_id: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/),
});

const AddDependencySchema = z.object({
  codespace_id: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/),
  package_name: z.string().min(1).max(200),
  version: z.string().optional(),
  dev: z.boolean().optional().default(false),
});

// ── Registration ───────────────────────────────────────────────────────────

export function registerCodespaceTemplateTools(
  registry: ToolRegistry,
  _userId: string,
): void {
  // ── codespace_list_templates ─────────────────────────────────────────
  registry.register({
    name: "codespace_list_templates",
    description: "Browse available project templates for codespace creation.\n"
      + "Optionally filter by category: react, next, dashboard, game, utility, blank.",
    category: "codespace-templates",
    tier: "free",
    inputSchema: ListTemplatesSchema.shape,
    handler: async (
      { category }: z.infer<typeof ListTemplatesSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("codespace_list_templates", async () => {
        const filtered = category
          ? TEMPLATES.filter(t => t.category === category)
          : TEMPLATES;

        if (filtered.length === 0) {
          return textResult(
            `No templates found for category "${String(category)}".`,
          );
        }

        const lines = filtered.map(t =>
          `- **${t.id}** — ${t.name} (${t.category})\n`
          + `  ${t.description}\n`
          + `  Files: ${t.fileCount} | `
          + `Dependencies: ${
            t.dependencies.length === 0 ? "none" : t.dependencies.map(d => d.name).join(", ")
          }`
        );

        return textResult(
          `**Available Templates (${filtered.length}):**\n\n${lines.join("\n\n")}`,
        );
      }),
  });

  // ── codespace_create_from_template ───────────────────────────────────
  registry.register({
    name: "codespace_create_from_template",
    description: "Create a new codespace pre-populated from a project template.\n"
      + "Returns the new codespace ID, name, and list of files created.",
    category: "codespace-templates",
    tier: "free",
    inputSchema: CreateFromTemplateSchema.shape,
    handler: async (
      { template_id, name, description }: z.infer<typeof CreateFromTemplateSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("codespace_create_from_template", async () => {
        const template = TEMPLATES.find(t => t.id === template_id);
        if (!template) {
          return {
            content: [{
              type: "text",
              text:
                `Template "${template_id}" not found. Use codespace_list_templates to browse available templates.`,
            }],
            isError: true,
          };
        }

        // Use the entry point (first file) as the session code, or blank
        const entryFile = template.files.find(f => f.path === "/src/App.tsx")
          ?? template.files[0];
        const entryCode = entryFile?.content ?? "export default function App() { return null; }";

        try {
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
          return {
            content: [{ type: "text", text: `Error creating codespace: ${msg}` }],
            isError: true,
          };
        }

        const fileList = template.files.map(f => `  - ${f.path}`).join("\n");
        const descLine = description
          ? `**Description:** ${description}\n`
          : `**Description:** ${template.description}\n`;

        return textResult(
          `**Codespace Created from Template!**\n\n`
            + `**ID:** ${name}\n`
            + `**Template:** ${template.name} (${template.id})\n`
            + descLine
            + `**Files created (${template.files.length}):**\n${fileList}\n`
            + (template.dependencies.length > 0
              ? `**Suggested dependencies:**\n${
                template.dependencies.map(d => `  - ${d.name}@${d.version}`).join("\n")
              }`
              : "**Dependencies:** none"),
        );
      }),
  });

  // ── codespace_get_dependencies ───────────────────────────────────────
  registry.register({
    name: "codespace_get_dependencies",
    description: "List npm dependencies inferred from a codespace's source code.\n"
      + "Parses import statements to detect external packages.",
    category: "codespace-templates",
    tier: "free",
    inputSchema: GetDependenciesSchema.shape,
    handler: async (
      { codespace_id }: z.infer<typeof GetDependenciesSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("codespace_get_dependencies", async () => {
        const { getSession } = await import("@/lib/codespace/session-service");
        const session = await getSession(codespace_id);

        if (!session) {
          return {
            content: [{
              type: "text",
              text: `Codespace "${codespace_id}" not found.`,
            }],
            isError: true,
          };
        }

        const deps = parseDependenciesFromCode(session.code);

        // Always exclude built-in React from the "external" list —
        // it is always present but bundled by the codespace runtime.
        const external = deps.filter(d => d.name !== "react" && d.name !== "react-dom");

        if (external.length === 0) {
          return textResult(
            `**Dependencies for codespace "${codespace_id}":**\n\n`
              + `No external npm dependencies detected.\n`
              + `_(Built-ins like react and react-dom are always available.)_`,
          );
        }

        const lines = external.map(
          d => `- **${d.name}** @ ${d.version} (${d.type})`,
        );

        return textResult(
          `**Dependencies for codespace "${codespace_id}" (${external.length}):**\n\n`
            + lines.join("\n"),
        );
      }),
  });

  // ── codespace_add_dependency ─────────────────────────────────────────
  registry.register({
    name: "codespace_add_dependency",
    description: "Record an npm package dependency for a codespace.\n"
      + "Appends an import stub at the top of the entry point so the package\n"
      + "is visible to subsequent dependency scans.",
    category: "codespace-templates",
    tier: "free",
    inputSchema: AddDependencySchema.shape,
    handler: async (
      { codespace_id, package_name, version, dev }: z.infer<typeof AddDependencySchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("codespace_add_dependency", async () => {
        const { getSession, upsertSession: upsert } = await import(
          "@/lib/codespace/session-service"
        );
        const session = await getSession(codespace_id);

        if (!session) {
          return {
            content: [{
              type: "text",
              text: `Codespace "${codespace_id}" not found.`,
            }],
            isError: true,
          };
        }

        const resolvedVersion = version ?? "latest";
        const depType: "dependency" | "devDependency" = dev ? "devDependency" : "dependency";

        // Append a comment-style import stub so parseDependenciesFromCode
        // will detect the package on the next codespace_get_dependencies call.
        const stub = `// dependency: ${package_name}@${resolvedVersion} (${depType})\n`;
        const alreadyPresent = session.code.includes(
          `// dependency: ${package_name}`,
        ) || new RegExp(`from ['"]${package_name}['"]`).test(session.code);

        if (!alreadyPresent) {
          const updatedCode = stub + session.code;
          await upsert({
            ...session,
            code: updatedCode,
            messages: session.messages ?? [],
          });
        }

        return textResult(
          `**Dependency added to codespace "${codespace_id}":**\n\n`
            + `- **Package:** ${package_name}\n`
            + `- **Version:** ${resolvedVersion}\n`
            + `- **Type:** ${depType}\n`
            + (alreadyPresent
              ? `\n_Package was already present — no changes made._`
              : `\n_Import stub recorded. Run codespace_update to apply._`),
        );
      }),
  });
}
