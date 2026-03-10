"use client";

import { useState, useCallback } from "react";
import { CheckCircle2, XCircle, ChevronRight, Share2 } from "lucide-react";
import { cn } from "@spike-land-ai/shared";
import { categorizeFile, parseImports } from "../core-logic/categorizer-engine";
import type { Category } from "../core-logic/categorizer-engine";

interface Question {
  id: number;
  code: string;
  filePath?: string;
  correct: Category;
  hint?: string;
}

const QUESTIONS: Question[] = [
  {
    id: 1,
    code: `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SessionManager } from "../core-logic/session-manager.js";
import { HNReadClient } from "../core-logic/hn-read-client.js";

const server = new McpServer({
  name: "hackernews-mcp",
  version: "0.1.0",
});`,
    correct: "mcp-tools",
  },
  {
    id: 2,
    code: `import { Link } from "@tanstack/react-router";
import { type AppStatus, StatusBadge } from "./StatusBadge";
import { Clock, User, Package, Zap } from "lucide-react";
import { cn } from "../../styling/cn";

interface AppCardProps {
  id: string;
  name: string;
  status: AppStatus;
  category?: "mcp" | "utility" | "game" | "tool";
}`,
    correct: "frontend",
  },
  {
    id: 3,
    code: `import { Hono } from "hono";
import type { Env } from "../../core-logic/env.js";
import { getClientId, sendGA4Events } from "../../lazy-imports/ga4.js";
import { safeCtx, withEdgeCache } from "../lib/edge-cache.js";

const blog = new Hono<{ Bindings: Env }>();

interface BlogPostRow {
  slug: string;
  title: string;
  content: string;
}`,
    correct: "edge-api",
  },
  {
    id: 4,
    code: `interface Parser {
  input: string;
  pos: number;
  context: Record<string, unknown>;
}

function createParser(expression: string, context: Record<string, unknown>): Parser {
  return { input: expression, pos: 0, context };
}

function skipWhitespace(p: Parser): void {
  while (p.pos < p.input.length && /\\s/.test(p.input[p.pos]!)) {
    p.pos++;
  }
}`,
    correct: "core",
  },
  {
    id: 5,
    code: `import { config } from "dotenv";
import { program } from "commander";
import { registerAuthCommand } from "./commands/auth";
import { registerShellCommand } from "./commands/shell";
import { registerStatusCommand } from "./commands/status";
import { setVerbose } from "./util/logger";
import { loadAliases } from "../node-sys/store";

config({ path: ".env.local", quiet: true });`,
    correct: "cli",
  },
  {
    id: 6,
    code: `export * from "./Scene01_Hook";
export * from "./Scene02_PhysicsOfAttention";
export * from "./Scene03_BeforeState";
export * from "./Scene04_FiveLayerStack";
export * from "./Scene05_FixLoop";
export * from "./Scene06_AgentMemory";
export * from "./VibeCodingParadox";`,
    correct: "media",
    filePath: "src/media/video/compositions/vibe-coding-paradox/index.ts",
    hint: 'The file path is the giveaway: "compositions/vibe-coding-paradox" — this is a Remotion video barrel file.',
  },
  {
    id: 7,
    code: `const UPSTREAM_ESM = "https://esm.sh";
const UPSTREAM_CDN = "https://cdn.jsdelivr.net/npm";

function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin") ?? "";
  const originHost = origin.replace(/^https?:\\/\\//, "").replace(/:\\d+$/, "");
  const allowed =
    originHost.endsWith(".spike.land") ||
    originHost === "spike.land";
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "https://spike.land",
  };
}`,
    correct: "utilities",
  },
];

const ALL_CATEGORIES: Category[] = [
  "mcp-tools",
  "frontend",
  "edge-api",
  "media",
  "cli",
  "core",
  "utilities",
];

const CATEGORY_LABELS: Record<Category, string> = {
  "mcp-tools": "MCP Tools",
  frontend: "Frontend",
  "edge-api": "Edge API",
  media: "Media",
  cli: "CLI",
  core: "Core",
  utilities: "Utilities",
};

const SCORE_FEEDBACK: Record<number, string> = {
  7: "Perfect score. You could have written the categorizer.",
  6: "Excellent. One slip — probably the barrel file.",
  5: "Solid. The ambiguous ones are genuinely tricky.",
  4: "Getting there. The engine had the same confusion at first.",
  3: "Halfway. The patterns become clearer once you see them a few times.",
  2: "The categorizer struggled too, at first.",
  1: "The good news: the tool does this automatically now.",
  0: "That's actually impressive in its own way.",
};

function shuffleFour(correct: Category): Category[] {
  const others = ALL_CATEGORIES.filter((c) => c !== correct);
  const picked: Category[] = [];
  const indices = new Set<number>();
  while (picked.length < 3) {
    const idx = Math.floor(Math.random() * others.length);
    if (!indices.has(idx)) {
      indices.add(idx);
      picked.push(others[idx]!);
    }
  }
  const four = [correct, ...picked];
  // Fisher-Yates shuffle
  for (let i = four.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = four[i]!;
    four[i] = four[j]!;
    four[j] = tmp;
  }
  return four;
}

// Pre-shuffle once so options don't re-randomize on each render
const SHUFFLED_OPTIONS = QUESTIONS.map((q) => shuffleFour(q.correct));

function getReason(question: Question): string {
  if (question.hint) return question.hint;
  const imports = parseImports(question.code);
  const result = categorizeFile(imports);
  return result.reason;
}

export function CodeCategorizerQuiz() {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState<(Category | null)[]>(
    new Array(QUESTIONS.length).fill(null),
  );
  const [showResult, setShowResult] = useState(false);

  const currentQuestion = QUESTIONS[currentIdx]!;
  const currentOptions = SHUFFLED_OPTIONS[currentIdx]!;
  const currentSelection = selected[currentIdx];
  const hasAnswered = currentSelection !== null;
  const isLast = currentIdx === QUESTIONS.length - 1;

  const score = selected.filter((ans, i) => ans === QUESTIONS[i]!.correct).length;

  const handleSelect = useCallback(
    (category: Category) => {
      if (hasAnswered) return;
      setSelected((prev) => {
        const next = [...prev];
        next[currentIdx] = category;
        return next;
      });
    },
    [currentIdx, hasAnswered],
  );

  const handleNext = useCallback(() => {
    if (isLast) {
      setShowResult(true);
    } else {
      setCurrentIdx((i) => i + 1);
    }
  }, [isLast]);

  const handleShare = useCallback(() => {
    const text = `I scored ${score}/7 on the TypeScript file categorizer quiz. Can you beat me?`;
    if (navigator.share) {
      void navigator.share({ text, url: window.location.href });
    } else {
      void navigator.clipboard.writeText(`${text} ${window.location.href}`);
    }
  }, [score]);

  if (showResult) {
    const feedbackKey = Math.min(score, 7) as keyof typeof SCORE_FEEDBACK;
    const feedback = SCORE_FEEDBACK[feedbackKey] ?? SCORE_FEEDBACK[0]!;
    return (
      <div className="flex flex-col items-center gap-6 px-6 py-10 text-center">
        <div className="text-6xl font-black tracking-tighter text-foreground">
          {score}
          <span className="text-3xl text-muted-foreground">/7</span>
        </div>
        <p className="max-w-sm text-base text-muted-foreground">{feedback}</p>
        <div className="flex flex-col gap-2 w-full max-w-xs">
          {QUESTIONS.map((q, i) => {
            const ans = selected[i];
            const correct = ans === q.correct;
            return (
              <div
                key={q.id}
                className={cn(
                  "flex items-center justify-between rounded-xl px-4 py-2 text-sm font-bold",
                  correct ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400",
                )}
              >
                <span>Q{q.id}</span>
                {correct ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <span className="text-xs">{CATEGORY_LABELS[q.correct]}</span>
                )}
              </div>
            );
          })}
        </div>
        <button
          onClick={handleShare}
          className="mt-2 flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-black tracking-tight text-primary-foreground shadow-lg transition-opacity hover:opacity-90"
        >
          <Share2 className="h-4 w-4" />
          Share your score
        </button>
      </div>
    );
  }

  const reason = hasAnswered ? getReason(currentQuestion) : null;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Progress */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">
          Question {currentIdx + 1} of {QUESTIONS.length}
        </span>
        <div className="flex gap-1">
          {QUESTIONS.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 w-6 rounded-full transition-colors",
                i < currentIdx ? "bg-emerald-500" : i === currentIdx ? "bg-primary" : "bg-border",
              )}
            />
          ))}
        </div>
      </div>

      {/* File path hint */}
      {currentQuestion.filePath && (
        <div className="rounded-xl bg-muted/40 px-3 py-1.5 text-xs font-mono text-muted-foreground">
          {currentQuestion.filePath}
        </div>
      )}

      {/* Code block */}
      <pre className="overflow-x-auto rounded-2xl bg-zinc-950 p-5 text-xs leading-relaxed dark:bg-zinc-900">
        <code className="text-zinc-100 font-mono">
          {currentQuestion.code.split("\n").map((line, lineIdx) => (
            <span key={lineIdx} className="block">
              {line
                .split(/(import|from|export|const|function|interface|type|return|while|if)\b/)
                .map((part, partIdx) => {
                  if (
                    [
                      "import",
                      "from",
                      "export",
                      "const",
                      "function",
                      "interface",
                      "type",
                      "return",
                      "while",
                      "if",
                    ].includes(part)
                  ) {
                    return (
                      <span key={partIdx} className="text-violet-400">
                        {part}
                      </span>
                    );
                  }
                  // Highlight string literals — use React children instead of
                  // dangerouslySetInnerHTML to prevent XSS if question data
                  // is ever sourced dynamically (OWASP A03, CWE-79).
                  const segments = part.split(/("[^"]*")/g);
                  return (
                    <span key={partIdx}>
                      {segments.map((seg, segIdx) =>
                        seg.startsWith('"') && seg.endsWith('"') ? (
                          <span key={segIdx} className="text-emerald-400">
                            {seg}
                          </span>
                        ) : (
                          seg
                        ),
                      )}
                    </span>
                  );
                })}
            </span>
          ))}
        </code>
      </pre>

      {/* Options */}
      <div className="grid grid-cols-2 gap-3">
        {currentOptions.map((category) => {
          const isSelected = currentSelection === category;
          const isCorrect = category === currentQuestion.correct;
          let stateClass = "bg-card border-border/50 hover:border-primary/50 hover:bg-primary/5";
          if (hasAnswered) {
            if (isCorrect) {
              stateClass = "bg-emerald-500/15 border-emerald-500/50 text-emerald-400";
            } else if (isSelected && !isCorrect) {
              stateClass = "bg-red-500/15 border-red-500/50 text-red-400";
            } else {
              stateClass = "bg-card border-border/30 opacity-40";
            }
          }

          return (
            <button
              key={category}
              onClick={() => handleSelect(category)}
              disabled={hasAnswered}
              className={cn(
                "flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-black tracking-tight transition-all",
                stateClass,
              )}
            >
              <span>{CATEGORY_LABELS[category]}</span>
              {hasAnswered && isCorrect && <CheckCircle2 className="h-4 w-4 shrink-0" />}
              {hasAnswered && isSelected && !isCorrect && <XCircle className="h-4 w-4 shrink-0" />}
            </button>
          );
        })}
      </div>

      {/* Reason */}
      {reason && (
        <div className="rounded-2xl bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          {reason}
        </div>
      )}

      {/* Next */}
      {hasAnswered && (
        <button
          onClick={handleNext}
          className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-black tracking-tight text-primary-foreground shadow-lg transition-opacity hover:opacity-90"
        >
          {isLast ? "See results" : "Next question"}
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
