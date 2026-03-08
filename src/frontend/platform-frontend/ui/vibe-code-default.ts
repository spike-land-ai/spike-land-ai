export const DEFAULT_VIBE_CODE = `import React, { useMemo, useState } from "react";

const APPS = [
  {
    id: "qa",
    name: "QA Studio",
    category: "Browser automation",
    status: "Live",
    metric: "128 checks in 41s",
    pitch: "Turn acceptance criteria into browser sessions with screenshots, traces, and deterministic assertions.",
    features: ["Playwright-grade runs", "Visual diffs", "Console capture"],
    command: [
      "browser.open('/pricing')",
      "browser.click('Start free')",
      "browser.assert('Checkout loaded')",
      "browser.screenshot('pricing-flow')",
    ],
  },
  {
    id: "bugbook",
    name: "Bugbook",
    category: "Signal-ranked triage",
    status: "Shipping",
    metric: "ELO-ranked fixes",
    pitch: "Rank bugs by urgency, not vibes, so the team ships the highest-leverage fix first.",
    features: ["Public queue", "ELO severity", "Fix history"],
    command: [
      "bugbook.report('Payment CTA is clipped on iPhone SE')",
      "bugbook.rank({ severity: 'high', reproducible: true })",
      "bugbook.assign('frontend-team')",
      "bugbook.publish('status update')",
    ],
  },
  {
    id: "learn",
    name: "Learn & Verify",
    category: "Interactive learning",
    status: "Verify",
    metric: "Proof, not passive reading",
    pitch: "Convert content into adaptive quizzes, badges, and verifiable understanding in one pass.",
    features: ["Quiz generation", "Badge proofs", "Session replay"],
    command: [
      "learn.extract('cloudflare-workers-guide')",
      "learn.generateQuiz({ rounds: 5, difficulty: 'adaptive' })",
      "learn.gradeSession()",
      "learn.issueBadge('workers-fundamentals')",
    ],
  },
  {
    id: "image",
    name: "Image Studio",
    category: "Media pipelines",
    status: "Ready",
    metric: "Campaign art in minutes",
    pitch: "Go from prompt to generated assets, variations, and delivery-ready bundles without leaving the workspace.",
    features: ["Prompt chains", "Batch variants", "Album outputs"],
    command: [
      "image.generate('Launch poster with amber kinetic type')",
      "image.upscale('hero-poster')",
      "image.variant({ ratio: '16:9', count: 4 })",
      "image.bundle('campaign-drop')",
    ],
  },
] as const;

const SIGNALS = [
  { value: "84", label: "tools wired", note: "registry, auth, browser, image and edge" },
  { value: "310ms", label: "preview loop", note: "edit, transpile, re-render in place" },
  { value: "3 rails", label: "one workspace", note: "chat, code and live app stay in sync" },
] as const;

const WALKTHROUGH = [
  {
    title: "Prompt the workflow",
    detail: "Describe the app in plain English and let the editor scaffold the first product-shaped slice.",
  },
  {
    title: "Watch the preview lock in",
    detail: "The live iframe mirrors every edit while syntax context and type feedback stay awake.",
  },
  {
    title: "Wire MCP actions",
    detail: "Swap static cards for real tools, browser flows, image pipelines, or bug streams without changing the shell.",
  },
] as const;

const ORBIT_CHIPS = [
  { label: "registry.search()", top: "10%", left: "12%" },
  { label: "browser.assert()", top: "21%", right: "7%" },
  { label: "image.generate()", top: "56%", right: "9%" },
  { label: "bugbook.rank()", bottom: "18%", left: "11%" },
  { label: "learn.issueBadge()", bottom: "8%", right: "23%" },
  { label: "workers.deploy()", top: "38%", left: "4%" },
] as const;

const STYLES = [
  "@keyframes orbitFloat { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }",
  "@keyframes scanLine { 0% { transform: translateY(-25%); opacity: 0; } 20% { opacity: 1; } 100% { transform: translateY(140%); opacity: 0; } }",
  ".spike-grid { background-image: linear-gradient(to right, color-mix(in srgb, var(--border-color) 72%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--border-color) 72%, transparent) 1px, transparent 1px); background-size: 42px 42px; }",
  ".glass-panel { background: color-mix(in srgb, var(--card-bg) 84%, transparent); backdrop-filter: blur(24px); }",
  ".orbit-chip { animation: orbitFloat 7s ease-in-out infinite; }",
  ".scan-line { animation: scanLine 6.5s linear infinite; }",
].join("");

const PANEL_STYLE = {
  background: "color-mix(in srgb, var(--card-bg) 84%, transparent)",
  border: "1px solid var(--border-color)",
  backdropFilter: "blur(24px)",
  boxShadow: "0 24px 80px color-mix(in srgb, var(--fg) 10%, transparent)",
} as const;

const INNER_PANEL_STYLE = {
  background: "color-mix(in srgb, var(--bg) 76%, transparent)",
  border: "1px solid color-mix(in srgb, var(--border-color) 78%, transparent)",
  boxShadow: "0 20px 50px color-mix(in srgb, var(--chat-accent) 12%, transparent)",
} as const;

export default function App() {
  const [activeId, setActiveId] = useState<(typeof APPS)[number]["id"]>("qa");
  const activeApp = useMemo(() => APPS.find((app) => app.id === activeId) ?? APPS[0], [activeId]);
  const themeMode =
    typeof document !== "undefined" ? document.documentElement.dataset.theme || "light" : "light";

  return (
    <div className="h-screen overflow-hidden bg-background text-foreground" style={{ fontFamily: "var(--font-sans)" }}>
      <style>{STYLES}</style>

      <div className="relative isolate h-screen overflow-hidden">
        <div className="spike-grid absolute inset-0 opacity-45" />
        <div
          className="absolute -left-16 top-0 h-72 w-72 rounded-full blur-3xl"
          style={{ background: "color-mix(in srgb, var(--chat-accent-light) 18%, transparent)" }}
        />
        <div
          className="absolute right-[-4rem] top-[14%] h-80 w-80 rounded-full blur-3xl"
          style={{ background: "color-mix(in srgb, var(--primary-light) 20%, transparent)" }}
        />
        <div
          className="absolute bottom-[-5rem] left-[28%] h-72 w-72 rounded-full blur-3xl"
          style={{ background: "color-mix(in srgb, var(--chat-accent) 14%, transparent)" }}
        />

        <div className="relative mx-auto flex h-full max-w-[1500px] flex-col px-4 py-4 sm:px-6 lg:px-8">
          <div className="grid gap-4 xl:grid-cols-[1.06fr_0.94fr]">
            <section className="rounded-[2rem] p-5 sm:p-6" style={PANEL_STYLE}>
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className="rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.32em]"
                  style={{
                    background: "color-mix(in srgb, var(--chat-accent) 12%, transparent)",
                    color: "var(--chat-accent)",
                  }}
                >
                  Rubik control room
                </span>
                <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground">
                  MCP-first apps
                </span>
                <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground">
                  {themeMode} mode synced
                </span>
              </div>

              <div className="mt-6 max-w-2xl">
                <p className="text-xs font-black uppercase tracking-[0.34em] text-muted-foreground">
                  spike.land / chat + code + preview
                </p>
                <h1
                  className="mt-3 text-4xl font-black tracking-tight sm:text-5xl 2xl:text-6xl"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  MCP apps that look like product
                  <span
                    className="mt-1 block text-transparent"
                    style={{
                      backgroundImage:
                        "linear-gradient(135deg, var(--fg) 0%, var(--chat-accent-light) 45%, var(--primary-light) 100%)",
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                    }}
                  >
                    and feel like instruments.
                  </span>
                </h1>
                <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                  Vibe through a live editor, let the preview answer instantly, then route browser
                  automation, bug triage, learning loops, and media pipelines through one design
                  language.
                </p>
              </div>

              <div className="mt-6 flex flex-wrap gap-2.5">
                {[
                  "live preview",
                  "dark/light aware surfaces",
                  "edge-ready from chat",
                ].map((label) => (
                  <span
                    key={label}
                    className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground"
                    style={{ background: "color-mix(in srgb, var(--muted-bg) 74%, transparent)" }}
                  >
                    {label}
                  </span>
                ))}
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {SIGNALS.map((signal) => (
                  <div
                    key={signal.label}
                    className="rounded-[1.35rem] p-3.5"
                    style={{
                      background: "color-mix(in srgb, var(--bg) 72%, transparent)",
                      border: "1px solid color-mix(in srgb, var(--border-color) 80%, transparent)",
                    }}
                  >
                    <p className="text-3xl font-black tracking-tight text-foreground">{signal.value}</p>
                    <p className="mt-1 text-xs font-black uppercase tracking-[0.24em] text-muted-foreground">
                      {signal.label}
                    </p>
                    <p className="mt-2 text-[13px] leading-5 text-muted-foreground">{signal.note}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="relative min-h-[320px] overflow-hidden rounded-[2rem] p-5" style={PANEL_STYLE}>
              <div className="absolute inset-5 rounded-full border border-border opacity-60" />
              <div className="absolute inset-12 rounded-full border border-border opacity-35" />
              <div className="scan-line absolute inset-x-0 top-0 h-24" style={{
                background:
                  "linear-gradient(180deg, transparent, color-mix(in srgb, var(--chat-accent) 16%, transparent), transparent)",
              }} />

              {ORBIT_CHIPS.map((chip, index) => (
                <div
                  key={chip.label}
                  className={"orbit-chip absolute rounded-full border border-border px-2.5 py-1 text-[10px] font-semibold text-muted-foreground " + (index > 2 ? "hidden 2xl:block" : "")}
                  style={{
                    ...chip,
                    background: "color-mix(in srgb, var(--bg) 82%, transparent)",
                    animationDelay: index * 0.55 + "s",
                    opacity: index > 2 ? 0.78 : 1,
                  }}
                >
                  {chip.label}
                </div>
              ))}

              <div className="relative z-10 ml-auto mt-10 max-w-[360px] rounded-[1.5rem] p-4" style={INNER_PANEL_STYLE}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-muted-foreground">
                      Selected app
                    </p>
                    <h2 className="mt-1.5 text-2xl font-black tracking-tight text-foreground">
                      {activeApp.name}
                    </h2>
                  </div>
                  <span
                    className="rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.24em]"
                    style={{
                      background:
                        activeApp.status === "Live"
                          ? "color-mix(in srgb, var(--success-fg) 14%, transparent)"
                          : activeApp.status === "Verify"
                            ? "color-mix(in srgb, var(--info-fg) 14%, transparent)"
                            : "color-mix(in srgb, var(--chat-accent) 14%, transparent)",
                      color:
                        activeApp.status === "Live"
                          ? "var(--success-fg)"
                          : activeApp.status === "Verify"
                            ? "var(--info-fg)"
                            : "var(--chat-accent)",
                    }}
                  >
                    {activeApp.status}
                  </span>
                </div>

                <p className="mt-3 text-sm leading-6 text-muted-foreground">{activeApp.pitch}</p>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div
                    className="rounded-[1rem] px-3 py-2.5"
                    style={{ background: "color-mix(in srgb, var(--muted-bg) 72%, transparent)" }}
                  >
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">
                      category
                    </p>
                    <p className="mt-1.5 text-sm font-bold text-foreground">{activeApp.category}</p>
                  </div>
                  <div
                    className="rounded-[1rem] px-3 py-2.5"
                    style={{ background: "color-mix(in srgb, var(--muted-bg) 72%, transparent)" }}
                  >
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">
                      signal
                    </p>
                    <p className="mt-1.5 text-sm font-bold text-foreground">{activeApp.metric}</p>
                  </div>
                  <div
                    className="rounded-[1rem] px-3 py-2.5"
                    style={{ background: "color-mix(in srgb, var(--muted-bg) 72%, transparent)" }}
                  >
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">
                      theme
                    </p>
                    <p className="mt-1.5 text-sm font-bold capitalize text-foreground">{themeMode}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {activeApp.features.map((feature) => (
                    <span
                      key={feature}
                      className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground"
                      style={{ background: "color-mix(in srgb, var(--card-bg) 70%, transparent)" }}
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            </section>
          </div>

          <div className="mt-4 grid min-h-0 gap-4 xl:grid-cols-[1.06fr_0.94fr]">
            <section className="rounded-[2rem] p-5" style={PANEL_STYLE}>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.28em] text-muted-foreground">
                    Featured MCP apps
                  </p>
                  <h2 className="mt-2 text-2xl font-black tracking-tight text-foreground">
                    Click an app. The control stack reconfigures.
                  </h2>
                </div>
                <p className="max-w-sm text-sm leading-6 text-muted-foreground">
                  A real product sample, not a floating hero card.
                </p>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {APPS.map((app) => {
                  const active = app.id === activeId;

                  return (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => setActiveId(app.id)}
                      className="rounded-[1.35rem] p-4 text-left transition-transform duration-300 hover:-translate-y-0.5"
                      style={{
                        background: active
                          ? "color-mix(in srgb, var(--chat-accent) 11%, var(--card-bg) 89%)"
                          : "color-mix(in srgb, var(--bg) 74%, transparent)",
                        border: active
                          ? "1px solid var(--chat-accent)"
                          : "1px solid color-mix(in srgb, var(--border-color) 84%, transparent)",
                        boxShadow: active
                          ? "0 20px 60px color-mix(in srgb, var(--chat-accent) 16%, transparent)"
                          : "0 16px 40px color-mix(in srgb, var(--fg) 7%, transparent)",
                      }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-muted-foreground">
                            {app.category}
                          </p>
                          <h3 className="mt-1.5 text-lg font-black tracking-tight text-foreground">
                            {app.name}
                          </h3>
                        </div>
                        <span
                          className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em]"
                          style={{
                            background: active
                              ? "color-mix(in srgb, var(--chat-accent) 18%, transparent)"
                              : "color-mix(in srgb, var(--muted-bg) 90%, transparent)",
                            color: active ? "var(--chat-accent)" : "var(--muted-fg)",
                          }}
                        >
                          {app.status}
                        </span>
                      </div>

                      <p className="mt-2.5 text-sm leading-5.5 text-muted-foreground">{app.pitch}</p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {app.features.map((feature) => (
                          <span
                            key={feature}
                            className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground"
                            style={{
                              background: "color-mix(in srgb, var(--card-bg) 70%, transparent)",
                            }}
                          >
                            {feature}
                          </span>
                        ))}
                      </div>

                      <p className="mt-3 text-xs font-black uppercase tracking-[0.28em] text-primary">
                        {app.metric}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-[2rem] p-5" style={PANEL_STYLE}>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.28em] text-muted-foreground">
                    DX walkthrough
                  </p>
                  <h2 className="mt-2 text-2xl font-black tracking-tight text-foreground">
                    The whole path is thought through.
                  </h2>
                </div>
              </div>

              <div className="mt-4 space-y-2.5">
                {WALKTHROUGH.map((item, index) => (
                  <div
                    key={item.title}
                    className="flex gap-3 rounded-[1.25rem] px-3.5 py-3.5"
                    style={{
                      background: "color-mix(in srgb, var(--bg) 74%, transparent)",
                      border: "1px solid color-mix(in srgb, var(--border-color) 82%, transparent)",
                    }}
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-black"
                      style={{
                        background: "color-mix(in srgb, var(--chat-accent) 14%, transparent)",
                        color: "var(--chat-accent)",
                      }}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </div>
                    <div>
                      <p className="text-sm font-black tracking-tight text-foreground">{item.title}</p>
                      <p className="mt-1 text-[13px] leading-5.5 text-muted-foreground">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div
                className="mt-4 rounded-[1.25rem] p-3.5"
                style={{
                  background: "color-mix(in srgb, var(--bg) 74%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--border-color) 82%, transparent)",
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.28em] text-muted-foreground">
                      Command rail
                    </p>
                    <p className="mt-1 text-sm text-foreground">
                      The selected app exposes an MCP-shaped flow instantly.
                    </p>
                  </div>
                  <span
                    className="rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.24em]"
                    style={{
                      background: "color-mix(in srgb, var(--success-fg) 14%, transparent)",
                      color: "var(--success-fg)",
                    }}
                  >
                    ready to ship
                  </span>
                </div>

                <pre
                  className="mt-3 overflow-x-auto rounded-[1rem] px-4 py-3 text-[13px] leading-6 text-foreground"
                  style={{
                    background: "color-mix(in srgb, var(--card-bg) 78%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--border-color) 82%, transparent)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {activeApp.command.join("\\n")}
                </pre>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
`;
