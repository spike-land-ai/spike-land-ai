"use client";

import type { ReactNode } from "react";
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
  RefreshCcw,
  Search,
  Sparkles,
  TestTube2,
} from "lucide-react";
import { useInViewProgress } from "../ui/useInViewProgress";

type Tone = "cyan" | "amber" | "emerald" | "rose" | "violet" | "slate";

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

function DemoShell({
  title,
  kicker,
  children,
}: {
  title: string;
  kicker: string;
  children: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-border/60 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))] p-6 md:p-8 text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.12),transparent_34%)]" />
      <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.28)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.28)_1px,transparent_1px)] [background-size:28px_28px]" />
      <div className="relative space-y-5">
        <div className="space-y-2">
          <div className="text-[10px] font-black uppercase tracking-[0.32em] text-cyan-200/80">
            {kicker}
          </div>
          <h3 className="text-xl font-black tracking-tight text-white md:text-2xl">{title}</h3>
        </div>
        {children}
      </div>
    </div>
  );
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-4 md:p-5 ${className}`}>
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
        scale: active ? [1, 1.015, 1] : 1,
        boxShadow: active
          ? [
            "0 0 0 rgba(34,211,238,0)",
            "0 0 18px rgba(34,211,238,0.2)",
            "0 0 0 rgba(34,211,238,0)",
          ]
          : "0 0 0 rgba(0,0,0,0)",
      }}
      transition={{ duration: 2.2, repeat: active ? Number.POSITIVE_INFINITY : 0, ease: "easeInOut" }}
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
}: {
  label: string;
  value: number;
  tone: Tone;
}) {
  const width = `${Math.max(10, Math.min(100, value))}%`;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300/70">
        <span>{label}</span>
        <span>{width}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/8">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width }}
          transition={{ duration: 1.1, ease: "easeOut" }}
          className={`h-full rounded-full ${tone === "cyan"
            ? "bg-cyan-400"
            : tone === "emerald"
              ? "bg-emerald-400"
              : tone === "rose"
                ? "bg-rose-400"
                : tone === "amber"
                  ? "bg-amber-400"
                  : "bg-violet-400"}`}
        />
      </div>
    </div>
  );
}

export function SharedOptimizationProblemDemo() {
  const { ref, progress } = useInViewProgress();
  const showInvalidation = progress > 0.38;

  return (
    <div ref={ref} className="my-12">
      <DemoShell title="Same invalidation shape" kicker="Docker vs LLM cache">
        <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
          <Panel className="space-y-3">
            <div className="flex items-center justify-between">
              <Label tone="cyan">
                <Package2 className="size-3" />
                Docker
              </Label>
              <span className="text-xs font-medium text-slate-400">deterministic layers</span>
            </div>
            {["base image", "dependencies", "app source", "build output"].map((label, index) => {
              const active = showInvalidation && index === 1;
              const dim = showInvalidation && index > 1;
              return (
                <LayerBar
                  key={label}
                  label={label}
                  tone={active ? "amber" : dim ? "rose" : "cyan"}
                  active={active}
                  dim={dim}
                />
              );
            })}
          </Panel>

          <motion.div
            animate={{ scale: [1, 1.06, 1], opacity: [0.65, 1, 0.65] }}
            transition={{ duration: 2.4, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
            className="mx-auto flex size-16 items-center justify-center rounded-full border border-violet-400/30 bg-violet-500/10 text-violet-100"
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
            {["system rules", "tool schema", "repo context", "task output"].map((label, index) => {
              const active = showInvalidation && index === 1;
              const dim = showInvalidation && index > 1;
              return (
                <LayerBar
                  key={label}
                  label={label}
                  tone={active ? "amber" : dim ? "rose" : "violet"}
                  active={active}
                  dim={dim}
                />
              );
            })}
          </Panel>
        </div>

        <div className="grid gap-3 text-sm text-slate-300 md:grid-cols-3">
          <Panel>Change an early Docker layer and later layers must rebuild.</Panel>
          <Panel>Change an early prompt prefix and later computation must rerun.</Panel>
          <Panel className="border-cyan-400/20 bg-cyan-500/10 text-cyan-50">
            Different mechanism. Same optimization law.
          </Panel>
        </div>
      </DemoShell>
    </div>
  );
}

export function PrefixInvalidationDemo() {
  const { ref } = useInViewProgress();
  const tokens = Array.from({ length: 8 }, (_, index) => index + 1);

  return (
    <div ref={ref} className="my-12">
      <DemoShell title="Early edits are expensive" kicker="Prefix invalidation">
        <div className="grid gap-4 md:grid-cols-2">
          {[
            { title: "early change", changed: 2, tone: "rose" as Tone },
            { title: "late change", changed: 7, tone: "emerald" as Tone },
          ].map((scenario) => {
            const invalidatedCount = tokens.filter((token) => token >= scenario.changed).length;
            return (
              <Panel key={scenario.title} className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label tone={scenario.tone}>{scenario.title}</Label>
                  <span className="text-xs font-semibold text-slate-400">
                    recompute {invalidatedCount}/8
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {tokens.map((token) => {
                    const changed = token === scenario.changed;
                    const invalidated = token > scenario.changed;
                    return (
                      <motion.div
                        key={token}
                        animate={{
                          y: changed ? [0, -3, 0] : 0,
                          opacity: invalidated ? 0.35 : 1,
                        }}
                        transition={{
                          duration: 1.8,
                          repeat: changed ? Number.POSITIVE_INFINITY : 0,
                          ease: "easeInOut",
                        }}
                        className={`flex h-14 items-center justify-center rounded-2xl border text-sm font-black ${changed
                          ? toneClasses("amber")
                          : invalidated
                            ? toneClasses("slate")
                            : toneClasses(scenario.tone)}`}
                      >
                        t{token}
                      </motion.div>
                    );
                  })}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                    <span>cache still valid</span>
                    <span>{scenario.changed - 1}/8</span>
                  </div>
                  <div className="flex gap-1">
                    {tokens.map((token) => (
                      <div
                        key={`${scenario.title}-${token}`}
                        className={`h-2 flex-1 rounded-full ${token < scenario.changed
                          ? scenario.tone === "rose"
                            ? "bg-rose-400"
                            : "bg-emerald-400"
                          : "bg-white/10"}`}
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
  const { ref } = useInViewProgress();

  return (
    <div ref={ref} className="my-12">
      <DemoShell title="Long chats are bad build graphs" kicker="Context window design">
        <div className="grid gap-4 md:grid-cols-2">
          <Panel className="space-y-4">
            <div className="flex items-center justify-between">
              <Label tone="rose">monolithic transcript</Label>
              <span className="text-xs font-semibold text-slate-400">compress after the fact</span>
            </div>
            <div className="space-y-2">
              {[
                "full repo",
                "full thread",
                "old errors",
                "old reviews",
                "deploy logs",
                "new request",
              ].map((label, index) => (
                <motion.div
                  key={label}
                  animate={{ x: [0, index % 2 === 0 ? 4 : -4, 0] }}
                  transition={{ duration: 2 + index * 0.12, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                  className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-50"
                >
                  {label}
                </motion.div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-50">
              <RefreshCcw className="size-4" />
              summarize the mess
            </div>
          </Panel>

          <Panel className="space-y-4">
            <div className="flex items-center justify-between">
              <Label tone="emerald">programmatic decomposition</Label>
              <span className="text-xs font-semibold text-slate-400">small contexts by stage</span>
            </div>
            <div className="grid gap-3">
              {[
                ["stable instructions", "task brief"],
                ["tool schema", "target files"],
                ["failing test", "patch diff"],
              ].map((pair) => (
                <div key={pair.join("-")} className="grid gap-2 md:grid-cols-2">
                  {pair.map((label, index) => (
                    <motion.div
                      key={label}
                      animate={{ scale: [1, 1.02, 1], opacity: [0.85, 1, 0.85] }}
                      transition={{ duration: 2.2 + index * 0.2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                      className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${index === 0 ? toneClasses("cyan") : toneClasses("emerald")}`}
                    >
                      {label}
                    </motion.div>
                  ))}
                </div>
              ))}
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              {["plan", "generate", "repair"].map((label) => (
                <div
                  key={label}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-center text-xs font-black uppercase tracking-[0.2em] text-slate-200"
                >
                  {label}
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </DemoShell>
    </div>
  );
}

function PipelineBox({
  icon,
  label,
  tone,
  dim = false,
}: {
  icon: ReactNode;
  label: string;
  tone: Tone;
  dim?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold ${toneClasses(tone)} ${dim ? "opacity-35" : ""}`}
    >
      <div className="flex size-8 items-center justify-center rounded-xl border border-white/10 bg-black/10">
        {icon}
      </div>
      <span>{label}</span>
    </div>
  );
}

export function MonolithAntiPatternDemo() {
  const { ref } = useInViewProgress();

  return (
    <div ref={ref} className="my-12">
      <DemoShell title="The same anti-pattern shows up twice" kicker="COPY . . in AI form">
        <div className="grid gap-4 md:grid-cols-2">
          <Panel className="space-y-3">
            <div className="flex items-center justify-between">
              <Label tone="cyan">
                <Package2 className="size-3" />
                Docker
              </Label>
              <span className="text-xs font-semibold text-slate-400">one volatile step too early</span>
            </div>
            <PipelineBox icon={<FileCode2 className="size-4" />} label="COPY . ." tone="amber" />
            <PipelineBox icon={<Blocks className="size-4" />} label="install deps" tone="rose" dim />
            <PipelineBox icon={<TestTube2 className="size-4" />} label="run tests" tone="rose" dim />
            <PipelineBox icon={<Package2 className="size-4" />} label="build image" tone="rose" dim />
          </Panel>

          <Panel className="space-y-3">
            <div className="flex items-center justify-between">
              <Label tone="violet">
                <Bot className="size-3" />
                Agent
              </Label>
              <span className="text-xs font-semibold text-slate-400">one giant prompt</span>
            </div>
            <PipelineBox icon={<FolderTree className="size-4" />} label="full repo + full thread" tone="amber" />
            <PipelineBox icon={<Sparkles className="size-4" />} label="plan + write code" tone="rose" dim />
            <PipelineBox icon={<Search className="size-4" />} label="debug + review" tone="rose" dim />
            <PipelineBox icon={<CheckCircle2 className="size-4" />} label="deploy outcome" tone="rose" dim />
          </Panel>
        </div>
      </DemoShell>
    </div>
  );
}

const STAGES = [
  { label: "classify", artifact: "task brief", tone: "cyan" as Tone, icon: <Binary className="size-4" /> },
  { label: "plan", artifact: "edit plan", tone: "violet" as Tone, icon: <Braces className="size-4" /> },
  { label: "generate", artifact: "patch", tone: "emerald" as Tone, icon: <FileCode2 className="size-4" /> },
  { label: "test", artifact: "fail/pass", tone: "amber" as Tone, icon: <TestTube2 className="size-4" /> },
  { label: "review", artifact: "findings", tone: "cyan" as Tone, icon: <Search className="size-4" /> },
  { label: "deploy", artifact: "release", tone: "emerald" as Tone, icon: <Package2 className="size-4" /> },
];

export function MultiStageBuildDemo() {
  const { ref } = useInViewProgress();

  return (
    <div ref={ref} className="my-12">
      <DemoShell title="Build the workflow as stages" kicker="Multi-stage execution">
        <div className="grid gap-3 lg:grid-cols-[repeat(6,minmax(0,1fr))]">
          {STAGES.map((stage, index) => (
            <div key={stage.label} className="relative space-y-2">
              <motion.div
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 2.1 + index * 0.12, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                className={`rounded-[1.5rem] border px-4 py-4 ${toneClasses(stage.tone)}`}
              >
                <div className="mb-3 flex size-9 items-center justify-center rounded-2xl border border-white/10 bg-black/10">
                  {stage.icon}
                </div>
                <div className="text-sm font-black uppercase tracking-[0.16em]">{stage.label}</div>
              </motion.div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300">
                artifact: {stage.artifact}
              </div>
              {index < STAGES.length - 1 && (
                <div className="hidden lg:flex absolute -right-3 top-10 z-20 items-center text-cyan-200/70">
                  <ChevronRight className="size-5" />
                </div>
              )}
            </div>
          ))}
        </div>

        <Panel className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-sm font-semibold text-slate-200">
            Each stage gets the smallest valid context and emits a typed artifact.
          </div>
          <div className="flex flex-wrap gap-2">
            <Label tone="emerald">rerun only what changed</Label>
            <Label tone="cyan">parallelize what is independent</Label>
          </div>
        </Panel>
      </DemoShell>
    </div>
  );
}

export function FocusedContextDemo() {
  const { ref } = useInViewProgress();

  return (
    <div ref={ref} className="my-12">
      <DemoShell title="Smaller context improves quality" kicker="Focus beats bloat">
        <div className="grid gap-4 md:grid-cols-2">
          <Panel className="space-y-4">
            <div className="flex items-center justify-between">
              <Label tone="rose">expensive + noisy</Label>
              <span className="text-xs font-semibold text-slate-400">wide search space</span>
            </div>
            <div className="grid grid-cols-6 gap-2">
              {Array.from({ length: 24 }, (_, index) => (
                <motion.div
                  key={index}
                  animate={{ opacity: [0.18, 0.55, 0.18] }}
                  transition={{ duration: 1.6 + (index % 5) * 0.18, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                  className={`h-10 rounded-xl ${index % 5 === 0 ? "bg-rose-400/35" : "bg-white/8"}`}
                />
              ))}
            </div>
            <div className="space-y-3">
              <MetricRow label="cache reuse" value={22} tone="rose" />
              <MetricRow label="token waste" value={86} tone="amber" />
              <MetricRow label="reasoning focus" value={28} tone="rose" />
            </div>
          </Panel>

          <Panel className="space-y-4">
            <div className="flex items-center justify-between">
              <Label tone="emerald">cheap + focused</Label>
              <span className="text-xs font-semibold text-slate-400">narrow search space</span>
            </div>
            <div className="grid grid-cols-6 gap-2">
              {Array.from({ length: 12 }, (_, index) => (
                <motion.div
                  key={index}
                  animate={{ scale: [1, 1.05, 1], opacity: [0.75, 1, 0.75] }}
                  transition={{ duration: 1.8 + (index % 4) * 0.14, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                  className={`h-10 rounded-xl ${index < 6 ? "bg-emerald-400/50" : "bg-cyan-400/30"}`}
                />
              ))}
              {Array.from({ length: 12 }).map((_, index) => (
                <div key={`filler-${index}`} className="h-10 rounded-xl bg-transparent" />
              ))}
            </div>
            <div className="space-y-3">
              <MetricRow label="cache reuse" value={88} tone="emerald" />
              <MetricRow label="token waste" value={18} tone="cyan" />
              <MetricRow label="reasoning focus" value={84} tone="emerald" />
            </div>
          </Panel>
        </div>
      </DemoShell>
    </div>
  );
}

export function PracticalRulesDemo() {
  const { ref } = useInViewProgress();
  const rules = [
    { label: "stable instructions first", tone: "cyan" as Tone },
    { label: "keep tool schemas stable", tone: "violet" as Tone },
    { label: "volatile input last", tone: "amber" as Tone },
    { label: "split into stages", tone: "emerald" as Tone },
    { label: "pass typed artifacts", tone: "cyan" as Tone },
    { label: "rerun only invalidated stages", tone: "emerald" as Tone },
    { label: "parallelize independent work", tone: "violet" as Tone },
  ];

  return (
    <div ref={ref} className="my-12">
      <DemoShell title="The rules are operational" kicker="Cache-aware checklist">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {rules.map((rule, index) => (
            <motion.div
              key={rule.label}
              animate={{ y: [0, -2, 0], opacity: [0.82, 1, 0.82] }}
              transition={{ duration: 1.8 + index * 0.08, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
              className={`rounded-[1.4rem] border px-4 py-4 text-sm font-black tracking-tight ${toneClasses(rule.tone)}`}
            >
              {rule.label}
            </motion.div>
          ))}
          <div className="rounded-[1.4rem] border border-white/10 bg-white/5 px-4 py-4 text-sm font-semibold text-slate-200 xl:col-span-1">
            Treat the prompt like a build graph, not a conversation dump.
          </div>
        </div>
      </DemoShell>
    </div>
  );
}

export function CacheAwareBuildGraphDemo() {
  const { ref } = useInViewProgress();

  return (
    <div ref={ref} className="my-12">
      <DemoShell title="This is build engineering" kicker="Final mental model">
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <Panel className="space-y-3">
            <div className="flex items-center justify-between">
              <Label tone="cyan">
                <Layers3 className="size-3" />
                layered prompt
              </Label>
              <span className="text-xs font-semibold text-slate-400">stable first, volatile last</span>
            </div>
            <LayerBar label="base instructions" tone="cyan" />
            <LayerBar label="tool contracts" tone="violet" />
            <LayerBar label="examples / rules" tone="emerald" />
            <LayerBar label="task-specific input" tone="amber" active />
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
              ].map((node) => (
                <div key={node.label} className={`rounded-2xl border px-4 py-3 text-sm font-black uppercase tracking-[0.16em] ${toneClasses(node.tone)}`}>
                  {node.label}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
              <Label tone="emerald">typed artifacts</Label>
              <ArrowRight className="size-4 text-cyan-200/60" />
              <Label tone="amber">narrow contexts</Label>
              <ArrowRight className="size-4 text-cyan-200/60" />
              <Label tone="violet">parallel work</Label>
            </div>
          </Panel>
        </div>
      </DemoShell>
    </div>
  );
}
