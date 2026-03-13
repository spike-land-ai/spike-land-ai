import { Link } from "@tanstack/react-router";
import { Clock, Sparkles, Zap } from "lucide-react";
import { useCallback, useState } from "react";
import { cn } from "../../../styling/cn";
import { AppPreview } from "../../components/create/AppPreview";
import { PromptInput } from "../../components/create/PromptInput";
import { useGenerate } from "../../components/create/useGenerate";

// ---------------------------------------------------------------------------
// Template definitions
// ---------------------------------------------------------------------------

interface Template {
  id: string;
  name: string;
  desc: string;
  icon: string;
  color: string;
}

const TEMPLATES: Template[] = [
  {
    id: "blank",
    name: "Blank",
    desc: "Start from scratch with a clean slate",
    icon: "⬜",
    color: "hover:border-zinc-400/40",
  },
  {
    id: "dashboard",
    name: "Dashboard",
    desc: "Admin panel with charts and tables",
    icon: "📊",
    color: "hover:border-blue-400/40",
  },
  {
    id: "chat-bot",
    name: "Chat Bot",
    desc: "Conversational AI interface",
    icon: "💬",
    color: "hover:border-violet-400/40",
  },
  {
    id: "form-builder",
    name: "Form Builder",
    desc: "Dynamic forms with validation",
    icon: "📝",
    color: "hover:border-emerald-400/40",
  },
  {
    id: "data-viz",
    name: "Data Viz",
    desc: "Interactive charts and graphs",
    icon: "📈",
    color: "hover:border-orange-400/40",
  },
  {
    id: "game",
    name: "Game",
    desc: "Interactive browser game",
    icon: "🎮",
    color: "hover:border-red-400/40",
  },
  {
    id: "landing-page",
    name: "Landing Page",
    desc: "Marketing page with CTA",
    icon: "🚀",
    color: "hover:border-cyan-400/40",
  },
  {
    id: "api-client",
    name: "API Client",
    desc: "REST/GraphQL explorer UI",
    icon: "🔌",
    color: "hover:border-amber-400/40",
  },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TemplateCard({ template, onSelect }: { template: Template; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group flex flex-col gap-2 rounded-xl border border-border bg-card p-4 text-left",
        "transition-all duration-150 hover:bg-muted",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70",
        "active:scale-[0.98]",
        template.color,
      )}
    >
      <span className="text-2xl" aria-hidden="true">
        {template.icon}
      </span>
      <div>
        <p className="text-sm font-semibold text-foreground group-hover:text-primary">
          {template.name}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{template.desc}</p>
      </div>
    </button>
  );
}

interface RecentEntry {
  id: string;
  prompt: string;
  app: { slug: string; title: string; previewUrl: string; generatedAt: string };
  generatedAt: string;
}

function RecentCreations({ history }: { history: RecentEntry[] }) {
  if (history.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Clock className="size-4 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Recent Creations</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {history.slice(0, 6).map((entry) => (
          <Link
            key={entry.id}
            to="/create/$appPath"
            params={{ appPath: entry.app.slug }}
            className={cn(
              "group flex flex-col gap-1.5 rounded-xl border border-border bg-card px-4 py-3",
              "transition-colors hover:border-primary/30 hover:bg-muted",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70",
            )}
          >
            <p className="line-clamp-1 text-sm font-medium text-foreground group-hover:text-primary">
              {entry.app.title}
            </p>
            <p className="line-clamp-2 text-xs text-muted-foreground">{entry.prompt}</p>
            <time
              className="mt-1 text-[11px] text-muted-foreground/50"
              dateTime={entry.generatedAt}
            >
              {new Date(entry.generatedAt).toLocaleDateString()}
            </time>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function CreateIndexPage() {
  const { status, app, error, steps, history, isGenerating, generate, reset } = useGenerate();

  const handleSubmit = useCallback(
    async (prompt: string) => {
      await generate({ prompt });
    },
    [generate],
  );

  const handleTemplateSelect = useCallback(
    async (templateId: string) => {
      if (templateId === "blank") {
        window.location.href = "/vibe-code";
        return;
      }
      await generate({
        prompt: `Build a ${TEMPLATES.find((t) => t.id === templateId)?.name ?? templateId} app`,
        template: templateId,
      });
    },
    [generate],
  );

  const [prompt, setPrompt] = useState("");

  const handlePromptSubmit = useCallback(() => {
    if (prompt.trim()) {
      void handleSubmit(prompt);
    }
  }, [prompt, handleSubmit]);

  return (
    <div className="mx-auto max-w-5xl space-y-10 py-8">
      {/* Header */}
      <div className="space-y-3 text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-xs font-medium text-primary">
          <Sparkles className="size-3" aria-hidden="true" />
          AI App Generator
        </div>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Build any app in seconds
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
          Describe what you want to build and AI generates a fully functional React application
          — instantly editable, instantly deployable.
        </p>
      </div>

      {/* Main generation area */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Left: prompt + templates */}
        <div className="flex flex-col gap-6">
          <PromptInput
            value={prompt}
            onChange={setPrompt}
            onSubmit={handlePromptSubmit}
            isLoading={isGenerating}
            placeholder="Describe the app you want to build..."
          />

          {/* Template gallery */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="size-4 text-muted-foreground" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-foreground">Start from a template</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
              {TEMPLATES.map((t) => (
                <TemplateCard key={t.id} template={t} onSelect={() => handleTemplateSelect(t.id)} />
              ))}
            </div>
          </section>
        </div>

        {/* Right: live preview */}
        <div className="flex flex-col gap-3">
          <AppPreview
            src={app?.previewUrl ?? null}
            isGenerating={isGenerating}
            generationSteps={steps}
            title={app?.title}
            className="flex-1"
          />

          {/* Post-generation actions */}
          {status === "success" && app && (
            <div className="flex flex-wrap gap-2">
              <a
                href={app.editorUrl}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold",
                  "text-primary-foreground transition-colors hover:bg-primary/90",
                )}
              >
                Open in Editor
              </a>
              <Link
                to="/create/$appPath"
                params={{ appPath: app.slug }}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-medium",
                  "text-foreground transition-colors hover:bg-muted",
                )}
              >
                View Details
              </Link>
              <button
                type="button"
                onClick={reset}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-medium",
                  "text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                )}
              >
                Start Over
              </button>
            </div>
          )}

          {/* Error state */}
          {status === "error" && error && (
            <div
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive"
            >
              <strong>Generation failed:</strong> {error}
            </div>
          )}
        </div>
      </div>

      {/* Recent creations */}
      <RecentCreations history={history} />
    </div>
  );
}
