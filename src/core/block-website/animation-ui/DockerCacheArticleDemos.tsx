"use client";

import { useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Binary,
  Blocks,
  Bot,
  Braces,
  CheckCircle2,
  ChevronRight,
  FileCode2,
  FolderTree,
  Layers3,
  Package2,
  Play,
  RefreshCcw,
  Search,
  Sparkles,
  TestTube2,
} from "lucide-react";
import { useInViewProgress } from "../ui/useInViewProgress";

type Tone = "cyan" | "amber" | "emerald" | "rose" | "violet" | "slate";

const SHARED_PHASES = [
  "All layers reuse cleanly",
  "A mid-stack change lands",
  "Everything after it invalidates",
  "Only the stable prefix survives",
] as const;

const PREFIX_PHASES = [
  "Same baseline on both sides",
  "Edit token 2",
  "Recompute almost everything",
  "Edit token 7",
  "Only one trailing token reruns",
] as const;

const CONTEXT_PHASES = [
  "The thread starts small",
  "The monolith keeps accreting",
  "Noise crowds the context",
  "Summarize after the fact",
  "Stage-sized contexts stay small",
] as const;

const ANTI_PATTERN_PHASES = [
  "Volatile input lands too early",
  "Docker reruns everything below",
  "The giant prompt does the same",
  "Every new error drags the whole stack",
] as const;

const MULTI_STAGE_PHASES = [
  "Classify the task",
  "Plan the change",
  "Generate the patch",
  "Test and review in parallel",
  "Deploy the passing result",
] as const;

const FOCUS_PHASES = [
  "Start with the task",
  "More context keeps arriving",
  "Noise widens the search space",
  "Focused scope stays cheaper and sharper",
] as const;

const FINAL_GRAPH_PHASES = [
  "Lay down the stable base",
  "Keep tool contracts stable",
  "Add rules and examples",
  "Append the volatile task input",
  "Route work through typed stages",
  "Rebuild only the affected stage",
] as const;

const MONOLITH_ITEMS = [
  "full repo",
  "full thread",
  "old errors",
  "old reviews",
  "deploy logs",
  "new request",
] as const;

const DECOMPOSED_PAIRS = [
  ["stable instructions", "task brief"],
  ["tool schema", "target files"],
  ["failing test", "patch diff"],
] as const;

function toneClasses(tone: Tone): string {
  switch (tone) {
    case "cyan":
      return "border-cyan-400/30 bg-cyan-500/10 text-cyan-100";
    case "amber":
      return "border-amber-400/30 bg-amber-500/10 text-amber-100";
    case "emerald":
      return "border-emerald-400/30 bg-emerald-500/10 text-emerald-100";
    case "rose":
      return "border-rose-400/30 bg-rose-500/10 text-rose-100";
    case "violet":
      return "border-violet-400/30 bg-violet-500/10 text-violet-100";
    case "slate":
    default:
      return "border-white/10 bg-white/5 text-slate-100";
  }
}

function getSequenceValue<T>(values: readonly T[], index: number): T {
  const safeIndex = Math.min(index, values.length - 1);
  const value = values[safeIndex];

  if (value === undefined) {
    throw new Error("Sequence value missing");
  }

  return value;
}

function useDemoSequence(length: number, intervalMs = 1500) {
  const { ref, progress } = useInViewProgress();
  const [step, setStep] = useState(0);
  const [runId, setRunId] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const isVisible = progress > 0.18;
  const isRunning = hasStarted && isVisible;

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const interval = window.setInterval(() => {
      setStep((current) => (current + 1) % length);
    }, intervalMs);

    return () => window.clearInterval(interval);
  }, [intervalMs, isRunning, length, runId]);

  const start = () => {
    setStep(0);
    setHasStarted(true);
    setRunId((current) => current + 1);
  };

  const restart = () => {
    setStep(0);
    setHasStarted(true);
    setRunId((current) => current + 1);
  };

  return { ref, step, hasStarted, isRunning, start, restart };
}

function DemoShell({
  title,
  kicker,
  status,
  hasStarted,
  onStart,
  onRestart,
  children,
}: {
  title: string;
  kicker: string;
  status: string;
  hasStarted: boolean;
  onStart: () => void;
  onRestart: () => void;
  children: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-border/60 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))] p-6 text-slate-100 md:p-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.12),transparent_34%)]" />
      <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.28)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.28)_1px,transparent_1px)] [background-size:28px_28px]" />
      <div className="relative space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="text-[10px] font-black uppercase tracking-[0.32em] text-cyan-200/80">
              {kicker}
            </div>
            <h3 className="text-xl font-black tracking-tight text-white md:text-2xl">{title}</h3>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="max-w-[16rem] rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-right text-[10px] font-black uppercase tracking-[0.18em] text-cyan-50">
              {status}
            </div>
            <button
              type="button"
              onClick={hasStarted ? onRestart : onStart}
              className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-200 transition-colors hover:border-cyan-300/50 hover:text-cyan-50"
            >
              {hasStarted ? <RefreshCcw className="size-3.5" /> : <Play className="size-3.5" />}
              {hasStarted ? "Restart" : "Start"}
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-4 md:p-5 ${className}`}
    >
      {children}
    </div>
  );
}

function Label({ children, tone = "slate" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] ${toneClasses(tone)}`}
    >
      {children}
    </span>
  );
}

function LayerBar({
  label,
  tone,
  active = false,
  dim = false,
}: {
  label: string;
  tone: Tone;
  active?: boolean;
  dim?: boolean;
}) {
  return (
    <motion.div
      animate={{
        opacity: dim ? 0.28 : 1,
        scale: active ? [1, 1.02, 1] : 1,
        boxShadow: active
          ? [
              "0 0 0 rgba(34,211,238,0)",
              "0 0 18px rgba(34,211,238,0.2)",
              "0 0 0 rgba(34,211,238,0)",
            ]
          : "0 0 0 rgba(0,0,0,0)",
      }}
      transition={{
        duration: 1.4,
        repeat: active ? Number.POSITIVE_INFINITY : 0,
        ease: "easeInOut",
      }}
      className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${toneClasses(tone)}`}
    >
      {label}
    </motion.div>
  );
}

function MetricRow({
  label,
  value,
  tone,
  animate = true,
}: {
  label: string;
  value: number;
  tone: Tone;
  animate?: boolean;
}) {
  const width = `${Math.max(10, Math.min(100, value))}%`;
  const fillClass =
    tone === "cyan"
      ? "bg-cyan-400"
      : tone === "emerald"
        ? "bg-emerald-400"
        : tone === "rose"
          ? "bg-rose-400"
          : tone === "amber"
            ? "bg-amber-400"
            : "bg-violet-400";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300/70">
        <span>{label}</span>
        <span>{width}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/8">
        <motion.div
          initial={{ width: animate ? 0 : width }}
          animate={{ width }}
          transition={{ duration: animate ? 0.8 : 0, ease: "easeOut" }}
          className={`h-full rounded-full ${fillClass}`}
        />
      </div>
    </div>
  );
}

function PipelineBox({
  icon,
  label,
  tone,
  dim = false,
  active = false,
}: {
  icon: ReactNode;
  label: string;
  tone: Tone;
  dim?: boolean;
  active?: boolean;
}) {
  return (
    <motion.div
      animate={{
        opacity: dim ? 0.35 : 1,
        y: active ? [0, -4, 0] : 0,
        scale: active ? [1, 1.02, 1] : 1,
      }}
      transition={{
        duration: 1.3,
        repeat: active ? Number.POSITIVE_INFINITY : 0,
        ease: "easeInOut",
      }}
      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold ${toneClasses(tone)}`}
    >
      <div className="flex size-8 items-center justify-center rounded-xl border border-white/10 bg-black/10">
        {icon}
      </div>
      <span>{label}</span>
    </motion.div>
  );
}

export function SharedOptimizationProblemDemo() {
  const { ref, step, hasStarted, isRunning, start, restart } = useDemoSequence(
    SHARED_PHASES.length,
    1700,
  );
  const showChange = step >= 1;
  const showInvalidation = step >= 2;

  return (
    <div ref={ref}>
      <DemoShell
        title="Same invalidation shape"
        kicker="Docker vs LLM cache"
        status={hasStarted ? getSequenceValue(SHARED_PHASES, step) : "Ready to start"}
        hasStarted={hasStarted}
        onStart={start}
        onRestart={restart}
      >
        <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
          <Panel className="space-y-3">
            <div className="flex items-center justify-between">
              <Label tone="cyan">
                <Package2 className="size-3" />
                Docker
              </Label>
              <span className="text-xs font-medium text-slate-400">deterministic layers</span>
            </div>
            {["base image", "dependencies", "app source", "build output"].map((label, index) => (
              <LayerBar
                key={label}
                label={label}
                tone={
                  showChange && index === 1
                    ? "amber"
                    : showInvalidation && index > 1
                      ? "rose"
                      : "cyan"
                }
                active={hasStarted && showChange && index === 1}
                dim={showInvalidation && index > 1}
              />
            ))}
          </Panel>

          <motion.div
            animate={{
              scale: hasStarted ? (showInvalidation ? [1, 1.08, 1] : [1, 1.03, 1]) : 1,
              opacity: hasStarted ? (showInvalidation ? [0.7, 1, 0.7] : [0.45, 0.8, 0.45]) : 0.45,
            }}
            transition={{
              duration: 1.8,
              repeat: isRunning ? Number.POSITIVE_INFINITY : 0,
              ease: "easeInOut",
            }}
            className="relative mx-auto flex size-16 items-center justify-center rounded-full border border-violet-400/30 bg-violet-500/10 text-violet-100"
          >
            <Blocks className="size-7" />
          </motion.div>

          <Panel className="space-y-3">
            <div className="flex items-center justify-between">
              <Label tone="violet">
                <Bot className="size-3" />
                LLM
              </Label>
              <span className="text-xs font-medium text-slate-400">prefix computation</span>
            </div>
            {["system rules", "tool schema", "repo context", "task output"].map((label, index) => (
              <LayerBar
                key={label}
                label={label}
                tone={
                  showChange && index === 1
                    ? "amber"
                    : showInvalidation && index > 1
                      ? "rose"
                      : "violet"
                }
                active={hasStarted && showChange && index === 1}
                dim={showInvalidation && index > 1}
              />
            ))}
          </Panel>
        </div>

        <div className="grid gap-3 text-sm text-slate-300 md:grid-cols-3">
          <Panel className={showChange ? "border-amber-400/20 bg-amber-500/10 text-amber-50" : ""}>
            The edit lands in the middle of both stacks.
          </Panel>
          <Panel
            className={showInvalidation ? "border-rose-400/20 bg-rose-500/10 text-rose-50" : ""}
          >
            Everything after that point has to rerun.
          </Panel>
          <Panel className="border-cyan-400/20 bg-cyan-500/10 text-cyan-50">
            Different mechanism. Same optimization law.
          </Panel>
        </div>
      </DemoShell>
    </div>
  );
}

export function PrefixInvalidationDemo() {
  const { ref, step, hasStarted, isRunning, start, restart } = useDemoSequence(
    PREFIX_PHASES.length,
    1350,
  );
  const tokens = Array.from({ length: 8 }, (_, index) => index + 1);

  return (
    <div ref={ref}>
      <DemoShell
        title="Early edits are expensive"
        kicker="Prefix invalidation"
        status={hasStarted ? getSequenceValue(PREFIX_PHASES, step) : "Ready to start"}
        hasStarted={hasStarted}
        onStart={start}
        onRestart={restart}
      >
        <div className="grid gap-4 md:grid-cols-2">
          {[
            {
              key: "early",
              title: "early change",
              changed: 2,
              tone: "rose" as Tone,
              readyStep: 1,
              invalidateStep: 2,
            },
            {
              key: "late",
              title: "late change",
              changed: 7,
              tone: "emerald" as Tone,
              readyStep: 3,
              invalidateStep: 4,
            },
          ].map((scenario) => {
            const invalidatedCount = tokens.filter((token) => token >= scenario.changed).length;
            const changeTriggered = step >= scenario.readyStep;
            const invalidationTriggered = step >= scenario.invalidateStep;
            const validCount = changeTriggered ? scenario.changed - 1 : 8;

            return (
              <Panel key={scenario.key} className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label tone={scenario.tone}>{scenario.title}</Label>
                  <span className="text-xs font-semibold text-slate-400">
                    recompute {invalidationTriggered ? invalidatedCount : 0}/8
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {tokens.map((token) => {
                    const changed = changeTriggered && token === scenario.changed;
                    const invalidated = invalidationTriggered && token > scenario.changed;

                    return (
                      <motion.div
                        key={token}
                        animate={{
                          y: changed ? [0, -4, 0] : 0,
                          scale: changed ? [1, 1.04, 1] : 1,
                          opacity: invalidated ? 0.28 : token <= validCount ? 1 : 0.82,
                        }}
                        transition={{
                          duration: 1.2,
                          repeat: changed && isRunning ? Number.POSITIVE_INFINITY : 0,
                          ease: "easeInOut",
                        }}
                        className={`flex h-14 items-center justify-center rounded-2xl border text-sm font-black ${
                          changed
                            ? toneClasses("amber")
                            : invalidated
                              ? toneClasses("slate")
                              : toneClasses(scenario.tone)
                        }`}
                      >
                        t{token}
                      </motion.div>
                    );
                  })}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                    <span>cache still valid</span>
                    <span>{validCount}/8</span>
                  </div>
                  <div className="flex gap-1">
                    {tokens.map((token) => (
                      <div
                        key={`${scenario.key}-${token}`}
                        className={`h-2 flex-1 rounded-full ${
                          token <= validCount
                            ? scenario.tone === "rose"
                              ? "bg-rose-400"
                              : "bg-emerald-400"
                            : "bg-white/10"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      </DemoShell>
    </div>
  );
}

export function ContextWindowDesignDemo() {
  const { ref, step, hasStarted, isRunning, start, restart } = useDemoSequence(
    CONTEXT_PHASES.length,
    1450,
  );
  const visiblePairs = Math.min(DECOMPOSED_PAIRS.length, step + 1);
  const visibleMonolithItems = Math.min(MONOLITH_ITEMS.length, (step + 1) * 2);

  return (
    <div ref={ref}>
      <DemoShell
        title="Long chats are bad build graphs"
        kicker="Context window design"
        status={hasStarted ? getSequenceValue(CONTEXT_PHASES, step) : "Ready to start"}
        hasStarted={hasStarted}
        onStart={start}
        onRestart={restart}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Panel className="space-y-4">
            <div className="flex items-center justify-between">
              <Label tone="rose">monolithic transcript</Label>
              <span className="text-xs font-semibold text-slate-400">compress after the fact</span>
            </div>
            <div className="space-y-2">
              {MONOLITH_ITEMS.map((label, index) => {
                const visible = index < visibleMonolithItems;
                const overloaded = step >= 2 && visible;

                return (
                  <motion.div
                    key={label}
                    animate={{
                      opacity: visible ? 1 : 0.18,
                      y: visible ? 0 : 10,
                      x: overloaded ? [0, index % 2 === 0 ? 5 : -5, 0] : 0,
                    }}
                    transition={{
                      duration: 1.4 + index * 0.05,
                      repeat: overloaded && isRunning ? Number.POSITIVE_INFINITY : 0,
                      ease: "easeInOut",
                    }}
                    className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-50"
                  >
                    {label}
                  </motion.div>
                );
              })}
            </div>
            <motion.div
              animate={{
                scale: step >= 3 ? [1, 1.03, 1] : 1,
                opacity: step >= 3 ? 1 : 0.55,
              }}
              transition={{
                duration: 1.2,
                repeat: step >= 3 && isRunning ? Number.POSITIVE_INFINITY : 0,
                ease: "easeInOut",
              }}
              className="flex items-center justify-center gap-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-50"
            >
              <RefreshCcw className="size-4" />
              summarize the mess
            </motion.div>
          </Panel>

          <Panel className="space-y-4">
            <div className="flex items-center justify-between">
              <Label tone="emerald">programmatic decomposition</Label>
              <span className="text-xs font-semibold text-slate-400">small contexts by stage</span>
            </div>
            <div className="grid gap-3">
              {DECOMPOSED_PAIRS.map((pair, pairIndex) => (
                <div key={pair.join("-")} className="grid gap-2 md:grid-cols-2">
                  {pair.map((label, itemIndex) => {
                    const visible = pairIndex < visiblePairs;
                    const active = pairIndex === visiblePairs - 1 && visible;

                    return (
                      <motion.div
                        key={label}
                        animate={{
                          opacity: visible ? 1 : 0.2,
                          y: visible ? 0 : 10,
                          scale: active ? [1, 1.02, 1] : 1,
                        }}
                        transition={{
                          duration: 1.2,
                          repeat: active && isRunning ? Number.POSITIVE_INFINITY : 0,
                          ease: "easeInOut",
                        }}
                        className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
                          itemIndex === 0 ? toneClasses("cyan") : toneClasses("emerald")
                        }`}
                      >
                        {label}
                      </motion.div>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              {["plan", "generate", "repair"].map((label, index) => (
                <motion.div
                  key={label}
                  animate={{
                    opacity: step >= 3 ? 1 : 0.25,
                    scale: step >= 3 && index === 1 ? [1, 1.03, 1] : 1,
                  }}
                  transition={{
                    duration: 1.2,
                    repeat: step >= 3 && index === 1 && isRunning ? Number.POSITIVE_INFINITY : 0,
                    ease: "easeInOut",
                  }}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-center text-xs font-black uppercase tracking-[0.2em] text-slate-200"
                >
                  {label}
                </motion.div>
              ))}
            </div>
          </Panel>
        </div>
      </DemoShell>
    </div>
  );
}

export function MonolithAntiPatternDemo() {
  const { ref, step, hasStarted, start, restart } = useDemoSequence(
    ANTI_PATTERN_PHASES.length,
    1500,
  );
  const dockerBreaks = step >= 1;
  const agentBreaks = step >= 2;

  return (
    <div ref={ref}>
      <DemoShell
        title="The same anti-pattern shows up twice"
        kicker="COPY . . in AI form"
        status={hasStarted ? getSequenceValue(ANTI_PATTERN_PHASES, step) : "Ready to start"}
        hasStarted={hasStarted}
        onStart={start}
        onRestart={restart}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Panel className="space-y-3">
            <div className="flex items-center justify-between">
              <Label tone="cyan">
                <Package2 className="size-3" />
                Docker
              </Label>
              <span className="text-xs font-semibold text-slate-400">
                one volatile step too early
              </span>
            </div>
            <PipelineBox
              icon={<FileCode2 className="size-4" />}
              label="COPY . ."
              tone="amber"
              active={hasStarted && step <= 1}
            />
            <PipelineBox
              icon={<Blocks className="size-4" />}
              label="install deps"
              tone="rose"
              dim={dockerBreaks}
            />
            <PipelineBox
              icon={<TestTube2 className="size-4" />}
              label="run tests"
              tone="rose"
              dim={dockerBreaks}
            />
            <PipelineBox
              icon={<Package2 className="size-4" />}
              label="build image"
              tone="rose"
              dim={dockerBreaks}
            />
          </Panel>

          <Panel className="space-y-3">
            <div className="flex items-center justify-between">
              <Label tone="violet">
                <Bot className="size-3" />
                Agent
              </Label>
              <span className="text-xs font-semibold text-slate-400">one giant prompt</span>
            </div>
            <PipelineBox
              icon={<FolderTree className="size-4" />}
              label="full repo + full thread"
              tone="amber"
              active={hasStarted && step >= 2}
            />
            <PipelineBox
              icon={<Sparkles className="size-4" />}
              label="plan + write code"
              tone="rose"
              dim={agentBreaks}
            />
            <PipelineBox
              icon={<Search className="size-4" />}
              label="debug + review"
              tone="rose"
              dim={agentBreaks}
            />
            <PipelineBox
              icon={<CheckCircle2 className="size-4" />}
              label="deploy outcome"
              tone="rose"
              dim={agentBreaks}
            />
          </Panel>
        </div>

        <div className="grid gap-3 text-sm text-slate-300 md:grid-cols-2">
          <Panel className={dockerBreaks ? "border-rose-400/20 bg-rose-500/10 text-rose-50" : ""}>
            One early source snapshot poisons the rest of the Docker build.
          </Panel>
          <Panel className={agentBreaks ? "border-rose-400/20 bg-rose-500/10 text-rose-50" : ""}>
            One giant prompt poisons planning, coding, testing, and review.
          </Panel>
        </div>
      </DemoShell>
    </div>
  );
}

const STAGES = [
  {
    label: "classify",
    artifact: "task brief",
    tone: "cyan" as Tone,
    icon: <Binary className="size-4" />,
  },
  {
    label: "plan",
    artifact: "edit plan",
    tone: "violet" as Tone,
    icon: <Braces className="size-4" />,
  },
  {
    label: "generate",
    artifact: "patch",
    tone: "emerald" as Tone,
    icon: <FileCode2 className="size-4" />,
  },
  {
    label: "test",
    artifact: "fail/pass",
    tone: "amber" as Tone,
    icon: <TestTube2 className="size-4" />,
  },
  {
    label: "review",
    artifact: "findings",
    tone: "cyan" as Tone,
    icon: <Search className="size-4" />,
  },
  {
    label: "deploy",
    artifact: "release",
    tone: "emerald" as Tone,
    icon: <Package2 className="size-4" />,
  },
];

const ACTIVE_STAGE_INDEXES = [[0], [1], [2], [3, 4], [5]] as const;
const COMPLETE_STAGE_INDEXES = [[], [0], [0, 1], [0, 1, 2], [0, 1, 2, 3, 4]] as const;

export function MultiStageBuildDemo() {
  const { ref, step, hasStarted, isRunning, start, restart } = useDemoSequence(
    MULTI_STAGE_PHASES.length,
    1500,
  );
  const activeIndexes = new Set<number>(getSequenceValue(ACTIVE_STAGE_INDEXES, step));
  const completeIndexes = new Set<number>(getSequenceValue(COMPLETE_STAGE_INDEXES, step));

  return (
    <div ref={ref}>
      <DemoShell
        title="Build the workflow as stages"
        kicker="Multi-stage execution"
        status={hasStarted ? getSequenceValue(MULTI_STAGE_PHASES, step) : "Ready to start"}
        hasStarted={hasStarted}
        onStart={start}
        onRestart={restart}
      >
        <div className="grid gap-3 lg:grid-cols-[repeat(6,minmax(0,1fr))]">
          {STAGES.map((stage, index) => {
            const active = activeIndexes.has(index);
            const complete = completeIndexes.has(index);
            const pending = !active && !complete;

            return (
              <div key={stage.label} className="relative space-y-2">
                <motion.div
                  animate={{
                    opacity: pending ? 0.32 : 1,
                    y: active ? [0, -4, 0] : 0,
                    scale: active ? [1, 1.02, 1] : 1,
                  }}
                  transition={{
                    duration: 1.3,
                    repeat: active && isRunning ? Number.POSITIVE_INFINITY : 0,
                    ease: "easeInOut",
                  }}
                  className={`rounded-[1.5rem] border px-4 py-4 ${toneClasses(stage.tone)}`}
                >
                  <div className="mb-3 flex size-9 items-center justify-center rounded-2xl border border-white/10 bg-black/10">
                    {stage.icon}
                  </div>
                  <div className="text-sm font-black uppercase tracking-[0.16em]">
                    {stage.label}
                  </div>
                </motion.div>
                <div
                  className={`rounded-2xl border px-3 py-2 text-xs font-semibold ${
                    pending
                      ? "border-white/8 bg-white/5 text-slate-500"
                      : "border-white/10 bg-white/5 text-slate-300"
                  }`}
                >
                  artifact: {stage.artifact}
                </div>
                {index < STAGES.length - 1 && (
                  <motion.div
                    animate={{
                      opacity: complete || active ? 1 : 0.18,
                      x: activeIndexes.has(index + 1) ? [0, 4, 0] : 0,
                    }}
                    transition={{
                      duration: 1.2,
                      repeat:
                        activeIndexes.has(index + 1) && isRunning ? Number.POSITIVE_INFINITY : 0,
                      ease: "easeInOut",
                    }}
                    className="absolute -right-3 top-10 z-20 hidden items-center text-cyan-200/70 lg:flex"
                  >
                    <ChevronRight className="size-5" />
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>

        <Panel className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-sm font-semibold text-slate-200">
            Each stage gets the smallest valid context and emits a typed artifact.
          </div>
          <div className="flex flex-wrap gap-2">
            <Label tone={step >= 4 ? "emerald" : "slate"}>rerun only what changed</Label>
            <Label tone={step >= 3 ? "cyan" : "slate"}>parallelize what is independent</Label>
          </div>
        </Panel>
      </DemoShell>
    </div>
  );
}

export function FocusedContextDemo() {
  const { ref, step, hasStarted, isRunning, start, restart } = useDemoSequence(
    FOCUS_PHASES.length,
    1400,
  );
  const wideCount = getSequenceValue([6, 14, 20, 24] as const, step);
  const narrowCount = getSequenceValue([6, 8, 10, 12] as const, step);
  const wideCacheReuse = getSequenceValue([58, 42, 30, 22] as const, step);
  const wideTokenWaste = getSequenceValue([34, 52, 70, 86] as const, step);
  const wideReasoningFocus = getSequenceValue([60, 48, 36, 28] as const, step);
  const narrowCacheReuse = getSequenceValue([58, 70, 80, 88] as const, step);
  const narrowTokenWaste = getSequenceValue([34, 28, 22, 18] as const, step);
  const narrowReasoningFocus = getSequenceValue([60, 72, 80, 84] as const, step);

  return (
    <div ref={ref}>
      <DemoShell
        title="Smaller context improves quality"
        kicker="Focus beats bloat"
        status={hasStarted ? getSequenceValue(FOCUS_PHASES, step) : "Ready to start"}
        hasStarted={hasStarted}
        onStart={start}
        onRestart={restart}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Panel className="space-y-4">
            <div className="flex items-center justify-between">
              <Label tone="rose">expensive + noisy</Label>
              <span className="text-xs font-semibold text-slate-400">wide search space</span>
            </div>
            <div className="grid grid-cols-6 gap-2">
              {Array.from({ length: 24 }, (_, index) => {
                const visible = index < wideCount;
                const highlighted = visible && index % 5 === 0;

                return (
                  <motion.div
                    key={index}
                    animate={{
                      opacity: visible ? (isRunning ? [0.22, 0.58, 0.22] : 0.22) : 0.08,
                    }}
                    transition={{
                      duration: 1.5 + (index % 5) * 0.12,
                      repeat: visible && isRunning ? Number.POSITIVE_INFINITY : 0,
                      ease: "easeInOut",
                    }}
                    className={`h-10 rounded-xl ${highlighted ? "bg-rose-400/35" : visible ? "bg-white/8" : "bg-white/[0.03]"}`}
                  />
                );
              })}
            </div>
            <div className="space-y-3">
              <MetricRow
                label="cache reuse"
                value={wideCacheReuse}
                tone="rose"
                animate={hasStarted}
              />
              <MetricRow
                label="token waste"
                value={wideTokenWaste}
                tone="amber"
                animate={hasStarted}
              />
              <MetricRow
                label="reasoning focus"
                value={wideReasoningFocus}
                tone="rose"
                animate={hasStarted}
              />
            </div>
          </Panel>

          <Panel className="space-y-4">
            <div className="flex items-center justify-between">
              <Label tone="emerald">cheap + focused</Label>
              <span className="text-xs font-semibold text-slate-400">narrow search space</span>
            </div>
            <div className="grid grid-cols-6 gap-2">
              {Array.from({ length: 24 }, (_, index) => {
                const visible = index < narrowCount;
                const fillClass = index < 6 ? "bg-emerald-400/50" : "bg-cyan-400/30";

                return (
                  <motion.div
                    key={index}
                    animate={{
                      opacity: visible ? (isRunning ? [0.75, 1, 0.75] : 0.75) : 0.03,
                      scale: visible ? (isRunning ? [1, 1.03, 1] : 1) : 1,
                    }}
                    transition={{
                      duration: 1.6 + (index % 4) * 0.12,
                      repeat: visible && isRunning ? Number.POSITIVE_INFINITY : 0,
                      ease: "easeInOut",
                    }}
                    className={`h-10 rounded-xl ${visible ? fillClass : "bg-transparent"}`}
                  />
                );
              })}
            </div>
            <div className="space-y-3">
              <MetricRow
                label="cache reuse"
                value={narrowCacheReuse}
                tone="emerald"
                animate={hasStarted}
              />
              <MetricRow
                label="token waste"
                value={narrowTokenWaste}
                tone="cyan"
                animate={hasStarted}
              />
              <MetricRow
                label="reasoning focus"
                value={narrowReasoningFocus}
                tone="emerald"
                animate={hasStarted}
              />
            </div>
          </Panel>
        </div>
      </DemoShell>
    </div>
  );
}

export function PracticalRulesDemo() {
  const { ref, step, hasStarted, isRunning, start, restart } = useDemoSequence(7, 1150);
  const rules = [
    { label: "stable instructions first", tone: "cyan" as Tone },
    { label: "keep tool schemas stable", tone: "violet" as Tone },
    { label: "volatile input last", tone: "amber" as Tone },
    { label: "split into stages", tone: "emerald" as Tone },
    { label: "pass typed artifacts", tone: "cyan" as Tone },
    { label: "rerun only invalidated stages", tone: "emerald" as Tone },
    { label: "parallelize independent work", tone: "violet" as Tone },
  ] as const;
  const currentRule = getSequenceValue(rules, step);

  return (
    <div ref={ref}>
      <DemoShell
        title="The rules are operational"
        kicker="Cache-aware checklist"
        status={
          hasStarted ? `Rule ${step + 1} / ${rules.length}: ${currentRule.label}` : "Ready to start"
        }
        hasStarted={hasStarted}
        onStart={start}
        onRestart={restart}
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {rules.map((rule, index) => {
            const visible = index <= step;
            const active = index === step;

            return (
              <motion.div
                key={rule.label}
                animate={{
                  opacity: visible ? 1 : 0.18,
                  y: active ? [0, -3, 0] : 0,
                  scale: active ? [1, 1.02, 1] : 1,
                }}
                transition={{
                  duration: 1.1,
                  repeat: active && isRunning ? Number.POSITIVE_INFINITY : 0,
                  ease: "easeInOut",
                }}
                className={`rounded-[1.4rem] border px-4 py-4 text-sm font-black tracking-tight ${toneClasses(rule.tone)}`}
              >
                {rule.label}
              </motion.div>
            );
          })}
          <motion.div
            animate={{
              opacity: step === rules.length - 1 ? [0.78, 1, 0.78] : 0.78,
            }}
            transition={{
              duration: 1.2,
              repeat: step === rules.length - 1 && isRunning ? Number.POSITIVE_INFINITY : 0,
              ease: "easeInOut",
            }}
            className="rounded-[1.4rem] border border-white/10 bg-white/5 px-4 py-4 text-sm font-semibold text-slate-200 xl:col-span-1"
          >
            Treat the prompt like a build graph, not a conversation dump.
          </motion.div>
        </div>
      </DemoShell>
    </div>
  );
}

export function CacheAwareBuildGraphDemo() {
  const { ref, step, hasStarted, isRunning, start, restart } = useDemoSequence(
    FINAL_GRAPH_PHASES.length,
    1450,
  );
  const visibleLayers = Math.min(4, step + 1);
  const showGraph = step >= 4;
  const rebuildMode = step >= 5;

  return (
    <div ref={ref}>
      <DemoShell
        title="This is build engineering"
        kicker="Final mental model"
        status={hasStarted ? getSequenceValue(FINAL_GRAPH_PHASES, step) : "Ready to start"}
        hasStarted={hasStarted}
        onStart={start}
        onRestart={restart}
      >
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <Panel className="space-y-3">
            <div className="flex items-center justify-between">
              <Label tone="cyan">
                <Layers3 className="size-3" />
                layered prompt
              </Label>
              <span className="text-xs font-semibold text-slate-400">
                stable first, volatile last
              </span>
            </div>
            {[
              { label: "base instructions", tone: "cyan" as Tone },
              { label: "tool contracts", tone: "violet" as Tone },
              { label: "examples / rules", tone: "emerald" as Tone },
              { label: "task-specific input", tone: "amber" as Tone },
            ].map((layer, index) => (
              <LayerBar
                key={layer.label}
                label={layer.label}
                tone={layer.tone}
                active={
                  hasStarted &&
                  (step === index || (rebuildMode && index === 3)) &&
                  index < visibleLayers
                }
                dim={index >= visibleLayers}
              />
            ))}
          </Panel>

          <Panel className="space-y-4">
            <div className="flex items-center justify-between">
              <Label tone="emerald">
                <FolderTree className="size-3" />
                build graph
              </Label>
              <span className="text-xs font-semibold text-slate-400">rebuild one stage</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {[
                { label: "classify", tone: "cyan" as Tone },
                { label: "generate", tone: "emerald" as Tone },
                { label: "test", tone: "amber" as Tone },
                { label: "review", tone: "violet" as Tone },
              ].map((node) => {
                const active = rebuildMode && node.label === "test";
                const dim = !showGraph || (rebuildMode && node.label !== "test");

                return (
                  <motion.div
                    key={node.label}
                    animate={{
                      opacity: dim ? 0.3 : 1,
                      scale: active ? [1, 1.03, 1] : 1,
                    }}
                    transition={{
                      duration: 1.2,
                      repeat: active && isRunning ? Number.POSITIVE_INFINITY : 0,
                      ease: "easeInOut",
                    }}
                    className={`rounded-2xl border px-4 py-3 text-sm font-black uppercase tracking-[0.16em] ${toneClasses(node.tone)}`}
                  >
                    {node.label}
                  </motion.div>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
              <Label tone={showGraph ? "emerald" : "slate"}>typed artifacts</Label>
              <ArrowRight className="size-4 text-cyan-200/60" />
              <Label tone={rebuildMode ? "amber" : "slate"}>narrow contexts</Label>
              <ArrowRight className="size-4 text-cyan-200/60" />
              <Label tone={showGraph ? "violet" : "slate"}>parallel work</Label>
            </div>
          </Panel>
        </div>
      </DemoShell>
    </div>
  );
}
