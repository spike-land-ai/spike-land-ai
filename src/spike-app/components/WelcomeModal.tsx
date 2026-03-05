import { useCallback, useEffect, useState } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { Zap, X, ChevronLeft, ChevronRight, Check, Sparkles, Rocket, Code, Image as ImageIcon, BarChart3, Workflow, Boxes, Globe, ShieldCheck } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/utils/cn";

const STORAGE_KEY = "spike_welcome_shown";

const INTERESTS = [
  { id: "AI Chat & Assistants", icon: Sparkles },
  { id: "Code Generation", icon: Code },
  { id: "Image & Media", icon: ImageIcon },
  { id: "Data Analysis", icon: BarChart3 },
  { id: "Automation & Workflows", icon: Workflow },
  { id: "MCP Tools", icon: Boxes },
  { id: "APIs & Integrations", icon: Globe },
  { id: "DevOps & CI/CD", icon: ShieldCheck },
];

const SUGGESTED_TOOLS: Record<string, { name: string; description: string }[]> = {
  "AI Chat & Assistants": [
    { name: "claude-chat", description: "Conversational AI powered by Claude" },
    { name: "openai-proxy", description: "GPT-4o via spike.land" },
  ],
  "Code Generation": [
    { name: "esbuild-wasm-mcp", description: "Transpile JS/TS in the browser" },
    { name: "spike-code", description: "Monaco editor with live preview" },
  ],
  "Image & Media": [
    { name: "mcp-image-studio", description: "AI image generation & enhancement" },
    { name: "remotion-video", description: "Programmatic video compositions" },
  ],
  "Data Analysis": [
    { name: "d1-query", description: "SQL over Cloudflare D1" },
    { name: "analytics-mcp", description: "Platform usage analytics" },
  ],
  "Automation & Workflows": [
    { name: "state-machine", description: "Statechart engine with guard parser" },
    { name: "qa-studio", description: "Browser automation via Playwright" },
  ],
  "MCP Tools": [
    { name: "spike-land-mcp", description: "80+ tools in one MCP registry" },
    { name: "hackernews-mcp", description: "Read & write HackerNews" },
  ],
  "APIs & Integrations": [
    { name: "spike-edge", description: "Edge API with Hono on Cloudflare" },
    { name: "openclaw-mcp", description: "MCP bridge for OpenClaw gateway" },
  ],
  "DevOps & CI/CD": [
    { name: "spike-review", description: "AI code review bot with GitHub" },
    { name: "vibe-dev", description: "Docker-based dev workflow tool" },
  ],
};

type Step = 0 | 1 | 2;

interface WelcomeModalProps {
  userName?: string | null;
}

export function WelcomeModal({ userName }: WelcomeModalProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setOpen(true);
    }
  }, []);

  const dismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  }, []);

  const trapRef = useFocusTrap(open, dismiss);

  function toggleInterest(interest: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(interest)) {
        next.delete(interest);
      } else {
        next.add(interest);
      }
      return next;
    });
  }

  const suggestedTools = Array.from(selected)
    .flatMap((i) => SUGGESTED_TOOLS[i] ?? [])
    .filter((tool, idx, arr) => arr.findIndex((t) => t.name === tool.name) === idx)
    .slice(0, 6);

  if (!open) return null;

  return (
    <div
      ref={trapRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to spike.land"
    >
      <div className="w-full max-w-lg rounded-3xl bg-card border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="border-b border-border/50 px-6 py-5 bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex gap-2" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={3}>
              {([0, 1, 2] as Step[]).map((s) => (
                <div
                  key={s}
                  className={cn(
                    "h-1.5 w-12 rounded-full transition-all duration-500",
                    s <= step ? "bg-primary shadow-[0_0_8px_rgba(var(--primary),0.4)]" : "bg-muted"
                  )}
                  aria-current={s === step ? "step" : undefined}
                />
              ))}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={dismiss}
              className="rounded-full size-8 text-muted-foreground"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="px-8 py-8 min-h-[320px] relative overflow-hidden">
          {step === 0 && (
            <div className="space-y-5 animate-in slide-in-from-right-4 fade-in duration-300">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner">
                <Rocket className="h-8 w-8" />
              </div>
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight text-foreground">
                  Welcome{userName ? `, ${userName}` : ""}!
                </h2>
                <p className="mt-2 text-muted-foreground leading-relaxed">
                  spike.land is your ultimate AI development playground. Build, test, and deploy with 80+ specialized tools.
                </p>
              </div>
              <ul className="space-y-3 text-sm font-medium text-muted-foreground/80">
                {[
                  { text: "Build and deploy AI-powered apps", icon: Check },
                  { text: "Browse 80+ MCP tools in one registry", icon: Boxes },
                  { text: "Collaborate with real-time preview", icon: Zap },
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-primary">
                      <item.icon className="size-3" />
                    </div>
                    {item.text}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5 animate-in slide-in-from-right-4 fade-in duration-300">
              <div>
                <h2 className="text-2xl font-bold text-foreground">What's your focus?</h2>
                <p className="text-sm text-muted-foreground mt-1">Select your interests for personalized tool recommendations.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {INTERESTS.map(({ id, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => toggleInterest(id)}
                    className={cn(
                      "flex flex-col items-start gap-2 rounded-2xl border p-4 text-sm font-semibold transition-all duration-200 group",
                      selected.has(id)
                        ? "border-primary bg-primary/5 text-primary shadow-sm"
                        : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    <Icon className={cn("size-5 transition-transform group-hover:scale-110", selected.has(id) ? "text-primary" : "text-muted-foreground/50")} />
                    {id}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5 animate-in slide-in-from-right-4 fade-in duration-300">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Top tools for you</h2>
                <p className="text-sm text-muted-foreground mt-1">Based on your interests, we recommend starting here:</p>
              </div>
              <div className="grid gap-3">
                {(suggestedTools.length > 0 ? suggestedTools : [
                  { name: "spike-land-mcp", description: "80+ tools in one MCP registry" },
                  { name: "spike-code", description: "Monaco editor with live preview" },
                  { name: "claude-chat", description: "Conversational AI powered by Claude" },
                ]).map((tool) => (
                  <div key={tool.name} className="flex items-center gap-4 rounded-2xl border border-border bg-background p-4 shadow-sm hover:border-primary/30 transition-colors">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                      <Zap className="size-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{tool.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{tool.description}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="ml-auto rounded-full size-8 shrink-0">
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border/50 px-8 py-5 bg-muted/20">
          {step > 0 ? (
            <Button
              variant="outline"
              onClick={() => setStep((s) => (s - 1) as Step)}
              className="rounded-xl px-6"
            >
              <ChevronLeft className="mr-2 size-4" />
              Back
            </Button>
          ) : (
            <button
              onClick={dismiss}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-4"
            >
              Skip intro
            </button>
          )}
          
          <Button
            onClick={step < 2 ? () => setStep((s) => (s + 1) as Step) : dismiss}
            className="rounded-xl px-8 shadow-lg shadow-primary/20"
          >
            {step === 0 ? "Get started" : step === 1 ? "Next" : "Start exploring"}
            {step < 2 && <ChevronRight className="ml-2 size-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
