import { Link } from "@tanstack/react-router";
import { AppCard } from "../../components/AppCard";
import type { AppStatus } from "../../components/StatusBadge";

interface McpToolEntry {
  id: string;
  name: string;
  description: string;
  status: AppStatus;
  category: "mcp" | "utility" | "game" | "tool" | "social" | "other";
  ownerName: string;
  createdAt: string;
  toolCount: number;
}

const mcpTools: McpToolEntry[] = [
  {
    id: "chess-engine",
    name: "Chess Engine",
    description: "ELO-rated chess with game, player, and challenge management via MCP tools",
    status: "live",
    category: "mcp",
    ownerName: "spike-team",
    createdAt: "2025-12-01T00:00:00Z",
    toolCount: 5,
  },
  {
    id: "qa-studio",
    name: "QA Studio",
    description: "Browser automation and testing utilities powered by Playwright via MCP",
    status: "live",
    category: "mcp",
    ownerName: "spike-team",
    createdAt: "2025-11-15T00:00:00Z",
    toolCount: 10,
  },
  {
    id: "audio-mixer",
    name: "Audio Mixer",
    description: "Audio track creation, effects processing, and mixing via MCP tools",
    status: "drafting",
    category: "mcp",
    ownerName: "community",
    createdAt: "2026-01-10T00:00:00Z",
    toolCount: 4,
  },
];

export function ToolsIndexPage() {
  return (
    <div className="rubik-container rubik-page rubik-stack">
      <section className="rubik-panel-strong flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl space-y-4">
          <span className="rubik-eyebrow">Package atlas</span>
          <div className="space-y-3">
            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
              Browse the MCP packages behind spike.land app surfaces.
            </h1>
            <p className="rubik-lede">
              Inspect source-facing packages, compare runtime capability, and jump into the product
              shell that wraps each tool family.
            </p>
          </div>
        </div>
        <Link
          to="/packages/new"
          search={{ prompt: "" }}
          className="inline-flex items-center justify-center rounded-xl bg-foreground px-5 py-3 text-sm font-medium text-background transition-colors hover:opacity-90"
        >
          Create Package
        </Link>
      </section>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {mcpTools.map((tool) => (
          <AppCard
            key={tool.id}
            id={tool.id}
            name={tool.name}
            description={tool.description}
            status={tool.status}
            category={tool.category}
            ownerName={tool.ownerName}
            createdAt={tool.createdAt}
            toolCount={tool.toolCount}
          />
        ))}
      </div>
    </div>
  );
}
