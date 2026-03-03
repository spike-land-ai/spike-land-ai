import { useState, useMemo, useCallback } from "react";
import { Search, ChevronDown, ChevronRight, Play, Zap } from "lucide-react";
import { useTools } from "@/hooks/useTools";
import { callTool, parseToolResult, type ToolInfo } from "@/api/client";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { CreditBadge } from "@/components/ui/CreditBadge";
import { DynamicToolForm } from "@/components/ui/DynamicToolForm";
import { ENHANCEMENT_COSTS } from "@/constants/enums";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAX_PARAM_CHIPS = 5;

function getCreditCost(tier: string): number {
  const key = tier as keyof typeof ENHANCEMENT_COSTS;
  return ENHANCEMENT_COSTS[key] ?? 0;
}

function getTierVariant(tier: string): "default" | "success" | "warning" | "error" | "info" {
  if (tier === "FREE") return "success";
  if (tier === "TIER_1K") return "info";
  if (tier === "TIER_2K") return "warning";
  if (tier === "TIER_4K") return "error";
  return "default";
}

// ---------------------------------------------------------------------------
// Workflow Recipes
// ---------------------------------------------------------------------------

interface Recipe {
  title: string;
  steps: string[];
  description: string;
}

const WORKFLOW_RECIPES: Recipe[] = [
  {
    title: "Upload → Enhance → Share",
    steps: ["img_upload", "img_enhance", "img_share"],
    description:
      "Upload a photo, run AI enhancement to boost quality, then generate a public share link for distribution.",
  },
  {
    title: "Generate → Album → Export",
    steps: ["img_generate", "img_album_add", "img_export"],
    description:
      "Generate an image from a text prompt, organise it into an album for easy browsing, then export to PNG/WebP.",
  },
  {
    title: "Subject → Generate → Analyze",
    steps: ["img_subject_create", "img_generate", "img_analyze"],
    description:
      "Register a subject reference, generate new variations with that subject, then analyze the results for tags and color palette.",
  },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface ParamChipsProps {
  tool: ToolInfo;
}

function ParamChips({ tool }: ParamChipsProps) {
  if (!tool.inputSchema?.properties) return null;

  const keys = Object.keys(tool.inputSchema.properties || {});
  const visible = keys.slice(0, MAX_PARAM_CHIPS);
  const overflow = keys.length - visible.length;

  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {visible.map((key) => (
        <Badge key={key} variant="default" className="font-mono text-[10px]">
          {key}
        </Badge>
      ))}
      {overflow > 0 && (
        <Badge variant="default" className="text-[10px] text-gray-500">
          +{overflow} more
        </Badge>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tool Card
// ---------------------------------------------------------------------------

interface ToolCardProps {
  tool: ToolInfo;
  onTryIt: (tool: ToolInfo) => void;
}

function ToolCard({ tool, onTryIt }: ToolCardProps) {
  const cost = getCreditCost(tool.tier);
  const tierVariant = getTierVariant(tool.tier);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="font-mono text-sm text-accent-400 truncate" title={tool.name}>
            {tool.name}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={tierVariant}>{tool.tier}</Badge>
          <CreditBadge cost={cost} />
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-gray-400 mt-1.5 leading-relaxed line-clamp-2">
        {tool.description}
      </p>

      {/* Parameter chips */}
      <ParamChips tool={tool} />

      {/* Actions */}
      <div className="mt-3 flex items-center justify-end">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onTryIt(tool)}
          className="gap-1.5 text-accent-400 border-accent-500/30 hover:border-accent-400/50 hover:text-accent-300"
        >
          <Play className="w-3 h-3" />
          Try It
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Category Section
// ---------------------------------------------------------------------------

interface CategorySectionProps {
  category: string;
  tools: ToolInfo[];
  expanded: boolean;
  onToggle: () => void;
  onTryIt: (tool: ToolInfo) => void;
}

function CategorySection({ category, tools, expanded, onToggle, onTryIt }: CategorySectionProps) {
  return (
    <section>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-900 transition-colors group"
        aria-expanded={expanded}
      >
        <span className="text-gray-400 group-hover:text-gray-300 transition-colors">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>
        <h2 className="text-sm font-semibold text-gray-200 group-hover:text-gray-100 transition-colors">
          {category}
        </h2>
        <span className="text-xs text-gray-500 ml-1">
          ({tools.length} {tools.length === 1 ? "tool" : "tools"})
        </span>
      </button>

      {expanded && (
        <div className="mt-2 ml-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {tools.map((tool) => (
            <ToolCard key={tool.name} tool={tool} onTryIt={onTryIt} />
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Try-It Modal
// ---------------------------------------------------------------------------

interface TryItResult {
  raw: string;
  isError: boolean;
}

interface TryItModalProps {
  tool: ToolInfo | null;
  onClose: () => void;
}

function TryItModal({ tool, onClose }: TryItModalProps) {
  const [result, setResult] = useState<TryItResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleClose = useCallback(() => {
    setResult(null);
    onClose();
  }, [onClose]);

  const handleSubmit = useCallback(
    async (values: Record<string, unknown>) => {
      if (!tool) return;
      setSubmitting(true);
      setResult(null);
      try {
        const toolResult = await callTool(tool.name, values);
        if (toolResult.isError) {
          const text = toolResult.content[0]?.text ?? "Tool returned an error.";
          setResult({ raw: text, isError: true });
          return;
        }
        // parseToolResult throws on error; here we already know it succeeded
        const parsed = parseToolResult<unknown>(toolResult);
        setResult({
          raw: JSON.stringify(parsed, null, 2),
          isError: false,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "An unexpected error occurred.";
        setResult({ raw: message, isError: true });
      } finally {
        setSubmitting(false);
      }
    },
    [tool],
  );

  if (!tool) return null;

  const cost = getCreditCost(tool.tier);
  const hasSchema =
    tool.inputSchema != null && Object.keys(tool.inputSchema.properties || {}).length > 0;

  return (
    <Modal
      open={tool !== null}
      onClose={handleClose}
      title={tool.name}
      maxWidth="max-w-xl"
      closeOnOutsideClick={false}
    >
      <div className="space-y-4">
        {/* Tool meta */}
        <div className="flex items-center gap-2">
          <Badge variant={getTierVariant(tool.tier)}>{tool.tier}</Badge>
          <CreditBadge cost={cost} />
        </div>
        <p className="text-sm text-gray-400">{tool.description}</p>

        {/* Form */}
        {hasSchema && tool.inputSchema ? (
          <DynamicToolForm
            schema={tool.inputSchema}
            toolName={tool.name}
            creditCost={cost}
            onSubmit={handleSubmit}
            loading={submitting}
          />
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">This tool takes no input parameters.</p>
            <div className="flex items-center gap-3">
              <Button onClick={() => handleSubmit({})} loading={submitting} size="sm">
                <Zap className="w-3.5 h-3.5" />
                Run {tool.name}
              </Button>
              <CreditBadge cost={cost} />
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div
            className={`rounded-lg border p-3 ${
              result.isError ? "bg-red-500/10 border-red-500/30" : "bg-gray-950 border-gray-800"
            }`}
          >
            <p
              className={`text-xs font-medium mb-1.5 ${
                result.isError ? "text-red-400" : "text-gray-400"
              }`}
            >
              {result.isError ? "Error" : "Result"}
            </p>
            <pre
              className={`text-xs overflow-auto max-h-60 whitespace-pre-wrap break-words ${
                result.isError ? "text-red-300" : "text-gray-300"
              }`}
            >
              {result.raw}
            </pre>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Workflow Recipe Card
// ---------------------------------------------------------------------------

function RecipeCard({ recipe }: { recipe: Recipe }) {
  return (
    <div className="flex-1 min-w-0 bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-200">{recipe.title}</h3>
      <div className="flex flex-wrap gap-1">
        {recipe.steps.map((step, idx) => (
          <span key={step} className="flex items-center gap-1">
            <span className="font-mono text-[10px] text-accent-400 bg-accent-500/10 border border-accent-500/20 rounded px-1.5 py-0.5">
              {step}
            </span>
            {idx < recipe.steps.length - 1 && <ChevronRight className="w-3 h-3 text-gray-600" />}
          </span>
        ))}
      </div>
      <p className="text-xs text-gray-500 leading-relaxed">{recipe.description}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ToolExplorer() {
  const { grouped, categories, loading, error } = useTools();

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [activeTool, setActiveTool] = useState<ToolInfo | null>(null);

  const categoryOptions = useMemo(
    () => [
      { value: "all", label: "All categories" },
      ...categories.map((c) => ({ value: c, label: c })),
    ],
    [categories],
  );

  const filteredGrouped = useMemo(() => {
    const q = search.trim().toLowerCase();

    const result = new Map<string, ToolInfo[]>();

    for (const [cat, tools] of grouped) {
      if (selectedCategory !== "all" && selectedCategory !== cat) continue;

      const filtered = q
        ? tools.filter(
            (t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q),
          )
        : tools;

      if (filtered.length > 0) {
        result.set(cat, filtered);
      }
    }

    return result;
  }, [grouped, search, selectedCategory]);

  const toggleCategory = useCallback((cat: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  }, []);

  const handleTryIt = useCallback((tool: ToolInfo) => {
    setActiveTool(tool);
  }, []);

  const handleModalClose = useCallback(() => {
    setActiveTool(null);
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <svg
            className="animate-spin w-8 h-8 text-accent-400"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <p className="text-sm text-gray-500">Loading tools...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center space-y-2">
          <p className="text-sm font-medium text-red-400">Failed to load tools</p>
          <p className="text-xs text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  const sortedFilteredCategories = Array.from(filteredGrouped.keys()).sort();
  const totalFilteredTools = Array.from(filteredGrouped.values()).reduce(
    (sum, tools) => sum + tools.length,
    0,
  );

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Tool Explorer</h1>
        <p className="text-gray-400 mt-1 text-sm">
          Browse and try all {totalFilteredTools} available MCP image tools
        </p>
      </div>

      {/* Search + filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tools by name or description..."
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-100
              placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-accent-500/50
              focus:border-accent-500 text-sm"
            aria-label="Search tools"
          />
        </div>
        <div className="sm:w-52">
          <Select
            options={categoryOptions}
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            aria-label="Filter by category"
          />
        </div>
      </div>

      {/* Empty state */}
      {sortedFilteredCategories.length === 0 && (
        <div className="text-center py-16 space-y-2">
          <p className="text-sm font-medium text-gray-400">No tools found</p>
          <p className="text-xs text-gray-600">Try a different search term or category filter.</p>
        </div>
      )}

      {/* Category sections */}
      <div className="space-y-6">
        {sortedFilteredCategories.map((cat) => {
          const tools = filteredGrouped.get(cat) ?? [];
          return (
            <CategorySection
              key={cat}
              category={cat}
              tools={tools}
              expanded={!collapsedCategories.has(cat)}
              onToggle={() => toggleCategory(cat)}
              onTryIt={handleTryIt}
            />
          );
        })}
      </div>

      {/* Divider */}
      <div className="border-t border-gray-800" />

      {/* Workflow Recipes */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-200">Workflow Recipes</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Common multi-step patterns for getting the most out of Pixel Studio tools.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {WORKFLOW_RECIPES.map((recipe) => (
            <RecipeCard key={recipe.title} recipe={recipe} />
          ))}
        </div>
      </section>

      {/* Try-It modal */}
      <TryItModal tool={activeTool} onClose={handleModalClose} />
    </div>
  );
}
