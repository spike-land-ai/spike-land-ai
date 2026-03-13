import { Link, useParams } from "@tanstack/react-router";
import { Code2, ExternalLink, Palette, Rocket, Zap } from "lucide-react";
import { useState } from "react";
import { cn } from "../../../styling/cn";
import { AppPreview } from "../../components/create/AppPreview";
import { Button } from "../../shared/ui/button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CustomizationOptions {
  colorScheme: "default" | "blue" | "violet" | "emerald" | "rose" | "amber";
  appName: string;
  features: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLOR_SCHEME_OPTIONS: Array<{
  id: CustomizationOptions["colorScheme"];
  label: string;
  swatch: string;
}> = [
  { id: "default", label: "Default", swatch: "bg-foreground" },
  { id: "blue", label: "Blue", swatch: "bg-blue-500" },
  { id: "violet", label: "Violet", swatch: "bg-violet-500" },
  { id: "emerald", label: "Emerald", swatch: "bg-emerald-500" },
  { id: "rose", label: "Rose", swatch: "bg-rose-500" },
  { id: "amber", label: "Amber", swatch: "bg-amber-500" },
];

const FEATURE_OPTIONS = [
  "Dark mode",
  "Authentication",
  "Database",
  "Responsive layout",
  "Animations",
  "Export to CSV",
  "Share button",
  "Keyboard shortcuts",
] as const;

const EDGE_BASE = "https://edge.spike.land";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function toDisplayName(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function buildEditorUrl(
  codespaceId: string,
  opts: CustomizationOptions,
  basePrompt: string,
): string {
  const featureText = opts.features.length > 0 ? `. Features: ${opts.features.join(", ")}` : "";
  const nameText =
    opts.appName && opts.appName !== toDisplayName(codespaceId)
      ? ` named "${opts.appName}"`
      : "";
  const colorText = opts.colorScheme !== "default" ? ` Use ${opts.colorScheme} color scheme.` : "";
  const fullPrompt = `${basePrompt}${nameText}${featureText}${colorText}`.trim();

  const params = new URLSearchParams({
    codeSpace: codespaceId,
    prompt: fullPrompt,
  });
  return `/vibe-code?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ColorSwatch({
  option,
  selected,
  onSelect,
}: {
  option: (typeof COLOR_SCHEME_OPTIONS)[number];
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${option.label} color scheme`}
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-lg border p-2 transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70",
        selected ? "border-primary/60 bg-primary/8" : "border-border hover:border-border/80 hover:bg-muted",
      )}
    >
      <div className={cn("h-5 w-5 rounded-full", option.swatch)} />
      <span className="text-[11px] text-muted-foreground">{option.label}</span>
    </button>
  );
}

function FeatureChip({
  feature,
  selected,
  onToggle,
}: {
  feature: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70",
        selected
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-muted/50 text-muted-foreground hover:border-border/80 hover:text-foreground",
      )}
    >
      {selected ? "✓ " : "+ "}
      {feature}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function CreateAppPage() {
  const { appPath } = useParams({ strict: false }) as { appPath: string };
  const displayName = toDisplayName(appPath);
  const previewSrc = `${EDGE_BASE}/live/${appPath}/index.html`;
  const basePrompt = `Create a ${displayName} app`;

  const [customization, setCustomization] = useState<CustomizationOptions>({
    colorScheme: "default",
    appName: displayName,
    features: [],
  });

  const [isDeploying, setIsDeploying] = useState(false);
  const [deployUrl, setDeployUrl] = useState<string | null>(null);

  const editorUrl = buildEditorUrl(appPath, customization, basePrompt);

  const toggleFeature = (feature: string) => {
    setCustomization((prev) => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter((f) => f !== feature)
        : [...prev.features, feature],
    }));
  };

  // Simulate deploy (real implementation would POST to /api/create/deploy)
  const handleDeploy = async () => {
    setIsDeploying(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setDeployUrl(`https://${appPath}.spike.land`);
    setIsDeploying(false);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 py-8">
      {/* Breadcrumb + title */}
      <div className="space-y-3">
        <Link
          to="/create"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          &larr; Back to Create
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{displayName}</h1>
            <p className="mt-1 text-muted-foreground">
              Customize this app, then open it in the editor or deploy to spike.land.
            </p>
          </div>

          {/* Quick actions */}
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" className="gap-2">
              <a href={previewSrc} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-3.5" />
                Live Preview
              </a>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* Left: preview */}
        <div className="flex flex-col gap-4">
          <AppPreview src={previewSrc} title={displayName} />
        </div>

        {/* Right: customization panel */}
        <div className="flex flex-col gap-6">
          {/* App name */}
          <section className="space-y-2">
            <label
              htmlFor="app-name"
              className="flex items-center gap-2 text-sm font-semibold text-foreground"
            >
              <Zap className="size-3.5 text-muted-foreground" aria-hidden="true" />
              App Name
            </label>
            <input
              id="app-name"
              type="text"
              value={customization.appName}
              onChange={(e) => setCustomization((p) => ({ ...p, appName: e.target.value }))}
              className={cn(
                "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm",
                "text-foreground placeholder:text-muted-foreground/60",
                "focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/30",
              )}
            />
          </section>

          {/* Color scheme */}
          <section className="space-y-2">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Palette className="size-3.5 text-muted-foreground" aria-hidden="true" />
              Color Scheme
            </p>
            <div className="grid grid-cols-6 gap-2">
              {COLOR_SCHEME_OPTIONS.map((opt) => (
                <ColorSwatch
                  key={opt.id}
                  option={opt}
                  selected={customization.colorScheme === opt.id}
                  onSelect={() => setCustomization((p) => ({ ...p, colorScheme: opt.id }))}
                />
              ))}
            </div>
          </section>

          {/* Features */}
          <section className="space-y-2">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Code2 className="size-3.5 text-muted-foreground" aria-hidden="true" />
              Features
            </p>
            <div className="flex flex-wrap gap-2">
              {FEATURE_OPTIONS.map((feature) => (
                <FeatureChip
                  key={feature}
                  feature={feature}
                  selected={customization.features.includes(feature)}
                  onToggle={() => toggleFeature(feature)}
                />
              ))}
            </div>
          </section>

          {/* CTA buttons */}
          <div className="flex flex-col gap-2 pt-2">
            <Button asChild className="gap-2">
              <Link to={editorUrl as string}>
                <Code2 className="size-4" />
                Customize in Editor
              </Link>
            </Button>

            {deployUrl ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/8 px-4 py-3 text-sm">
                <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                  Deployed successfully!
                </p>
                <a
                  href={deployUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 flex items-center gap-1.5 text-xs text-emerald-600 underline underline-offset-2 dark:text-emerald-400"
                >
                  <ExternalLink className="size-3" />
                  {deployUrl}
                </a>
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={() => void handleDeploy()}
                disabled={isDeploying}
                className="gap-2"
              >
                {isDeploying ? (
                  <>
                    <span
                      className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
                      aria-hidden="true"
                    />
                    Deploying…
                  </>
                ) : (
                  <>
                    <Rocket className="size-4" />
                    Deploy to spike.land
                  </>
                )}
              </Button>
            )}

            <Link
              to="/create"
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-xl border border-border",
                "px-5 py-2.5 text-sm font-medium text-muted-foreground",
                "transition-colors hover:bg-muted hover:text-foreground",
              )}
            >
              Create Something New
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
