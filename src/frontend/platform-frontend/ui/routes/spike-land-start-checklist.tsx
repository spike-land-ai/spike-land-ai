import React, { useState, useEffect } from "react";

interface Task {
  id: string;
  title: string;
  desc?: string;
  status: "done" | "todo";
  source?: string;
}

const STAGES = [
  {
    number: 1,
    title: "Foundation & Validation",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    solidBg: "bg-cyan-500",
    border: "border-cyan-500/20",
    tasks: [
      { id: "1.1", title: "Validate Core Problem", status: "done" },
      { id: "1.2", title: "Define Mission & Vision", status: "done" },
      { id: "1.3", title: "Map Competitive Landscape", status: "done" },
      { id: "1.4", title: "Establish Legal Entity & IP", status: "done" },
      { id: "1.5", title: "Choose Business Model", status: "done" },
      { id: "1.6", title: "Set Up Dev Infrastructure", status: "done" },
      { id: "1.7", title: "Build Landing Page & Waitlist", status: "todo" },
      { id: "1.8", title: "ICO Registration", status: "todo", source: "Legal" },
      { id: "1.9", title: "Add Root LICENSE File (MIT)", status: "todo", source: "Legal" },
      { id: "1.10", title: "DPA with Cloudflare", status: "todo", source: "Legal" },
      { id: "1.11", title: "SEIS Advance Assurance Filing", status: "todo", source: "Fundraising" },
    ] as Task[],
  },
  {
    number: 2,
    title: "Build & Launch",
    color: "text-fuchsia-400",
    bg: "bg-fuchsia-500/10",
    solidBg: "bg-fuchsia-500",
    border: "border-fuchsia-500/20",
    tasks: [
      { id: "2.1", title: "Ship MVP — Lazy MCP Multiplexer", status: "done" },
      { id: "2.2", title: "Publish spike-cli to Public npm", status: "todo", source: "DX" },
      { id: "2.3", title: "Publish Documentation & Tutorials", status: "todo" },
      { id: "2.4", title: "Integrate Auth & Usage Tracking", status: "done" },
      { id: "2.5", title: "Enhance API Key Encryption", status: "todo", source: "Security" },
      { id: "2.6", title: "Enhance Rate Limiter Reliability", status: "todo", source: "Security" },
      { id: "2.7", title: "Wire KPI Dashboard to D1 Data", status: "todo", source: "Business" },
      {
        id: "2.8",
        title: "List on MCP Registries (Smithery, Glama)",
        status: "todo",
        source: "Growth",
      },
      { id: "2.9", title: "Product Hunt / HN Launch", status: "todo" },
      { id: "2.10", title: "Collapse Navigation to 5-7 Links", status: "todo", source: "Product" },
      { id: "2.11", title: "Launch Developer Community", status: "todo" },
      { id: "2.12", title: "Set Up KPI Dashboard", status: "todo" },
    ] as Task[],
  },
  {
    number: 3,
    title: "Harden & Monetize",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    solidBg: "bg-emerald-500",
    border: "border-emerald-500/20",
    tasks: [
      { id: "3.1", title: "Complete Stripe Integration", status: "todo" },
      { id: "3.2", title: "Ship API Access Tier ($49/mo)", status: "todo", source: "Growth" },
      { id: "3.3", title: "Enhance Content Security Policy", status: "todo", source: "Security" },
      {
        id: "3.4",
        title: "Enhance Secret Comparison Security",
        status: "todo",
        source: "Security",
      },
      { id: "3.5", title: "Add Onboarding Wizard for spike-cli", status: "todo", source: "DX" },
      {
        id: "3.6",
        title: "Bootstrap to 50 Paying Customers",
        status: "todo",
        source: "Fundraising",
      },
      { id: "3.7", title: "GDPR Article 30 Compliance Register", status: "todo", source: "Legal" },
      { id: "3.8", title: "Establish Partnerships", status: "todo" },
      { id: "3.9", title: "Add D1 Disk Quota Alerting (18/25GB)", status: "todo", source: "Infra" },
    ] as Task[],
  },
  {
    number: 4,
    title: "Scale & Grow",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    solidBg: "bg-amber-500",
    border: "border-amber-500/20",
    tasks: [
      {
        id: "4.1",
        title: "SEIS Raise (after 50 paying customers)",
        status: "todo",
        source: "Fundraising",
      },
      { id: "4.2", title: "Expand Tool Catalog to 1,000+", status: "todo" },
      { id: "4.3", title: "Launch Marketplace (70/30 revenue share)", status: "todo" },
      { id: "4.4", title: "Build Agent Orchestration Layer", status: "todo" },
      { id: "4.5", title: "WhatsApp & Telegram Integration", status: "todo" },
      { id: "4.6", title: "Managed Deployments — `spike deploy`", status: "todo" },
      { id: "4.7", title: "Launch Enterprise Tier (SSO/SAML)", status: "todo" },
      { id: "4.8", title: "Canary Deployment Strategy", status: "todo", source: "Infra" },
      { id: "4.9", title: "SOC 2 Type II Audit", status: "todo", source: "Security" },
    ] as Task[],
  },
];

const QUIZ_QUESTIONS = [
  {
    id: 1,
    text: "Which file defines the TanStack Router routes for spike-app?",
    options: [
      { id: "A", text: "src/frontend/platform-frontend/ui/main.tsx" },
      { id: "B", text: "src/frontend/platform-frontend/ui/router.ts", correct: true },
      { id: "C", text: "packages/spike-app/vite.config.ts" },
      { id: "D", text: "src/frontend/platform-frontend/ui/routes/__root.tsx" },
    ],
  },
  {
    id: 2,
    text: "How do you verify the dev-only route guard works?",
    options: [
      { id: "A", text: "Write a Vitest unit test that mocks window.location.hostname" },
      { id: "B", text: "Deploy to production and check" },
      {
        id: "C",
        text: "Access the URL on both local.spike.land and spike.land and verify behavior",
        correct: true,
      },
      { id: "D", text: "Check the TypeScript compiler output" },
    ],
  },
  {
    id: 3,
    text: "What happens if localStorage is unavailable (private browsing)?",
    options: [
      { id: "A", text: "The page crashes with an unhandled error" },
      { id: "B", text: "Checkboxes work but state resets on reload", correct: true },
      { id: "C", text: "The page redirects to the login page" },
      { id: "D", text: "All tasks show as completed" },
    ],
  },
  {
    id: 4,
    text: "Does this page require any new npm packages?",
    options: [
      { id: "A", text: "Yes, we need a checkbox UI library" },
      { id: "B", text: "Yes, we need @tanstack/react-query for state" },
      {
        id: "C",
        text: "No, it only uses React hooks and existing Tailwind classes",
        correct: true,
      },
      { id: "D", text: "Yes, we need localStorage polyfill" },
    ],
  },
  {
    id: 5,
    text: "What if the hostname guard uses import.meta.env instead of window.location?",
    options: [
      { id: "A", text: "It works the same way" },
      {
        id: "B",
        text: "It fails at build time because env vars are inlined by Vite",
        correct: true,
      },
      { id: "C", text: "It works but is slower" },
      { id: "D", text: "It only works in development mode" },
    ],
  },
  {
    id: 6,
    text: "How do you confirm the page is NOT accessible in production?",
    options: [
      { id: "A", text: "Check the Cloudflare Workers logs" },
      { id: "B", text: "The route doesn't exist in the production build" },
      {
        id: "C",
        text: "Visit https://spike.land/spike-land-start-checklist and verify it redirects to /",
        correct: true,
      },
      { id: "D", text: "Run npm run build and grep the output" },
    ],
  },
];

export function SpikeLandStartChecklistPage() {
  const [completedTasks, setCompletedTasks] = useState<Record<string, boolean>>({});
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const storedTasks = localStorage.getItem("spike_checklist_tasks");
      const storedQuiz = localStorage.getItem("spike_checklist_quiz");
      if (storedTasks) setCompletedTasks(JSON.parse(storedTasks));
      else {
        // Pre-check "done" tasks
        const initialTasks: Record<string, boolean> = {};
        STAGES.forEach((stage) => {
          stage.tasks.forEach((task) => {
            if (task.status === "done") initialTasks[task.id] = true;
          });
        });
        setCompletedTasks(initialTasks);
      }
      if (storedQuiz) setQuizAnswers(JSON.parse(storedQuiz));
    } catch (_e) {
      // Ignore localStorage errors (e.g., private browsing)
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem("spike_checklist_tasks", JSON.stringify(completedTasks));
      localStorage.setItem("spike_checklist_quiz", JSON.stringify(quizAnswers));
    } catch (_e) {
      // Ignore
    }
  }, [completedTasks, quizAnswers, isLoaded]);

  const toggleTask = (taskId: string) => {
    setCompletedTasks((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  const handleQuizAnswer = (questionId: number, optionId: string) => {
    setQuizAnswers((prev) => ({
      ...prev,
      [questionId]: optionId,
    }));
  };

  const totalTasks = STAGES.reduce((acc, stage) => acc + stage.tasks.length, 0);
  const completedCount = Object.values(completedTasks).filter(Boolean).length;
  const overallProgress = (completedCount / totalTasks) * 100;

  const quizScore = QUIZ_QUESTIONS.reduce((score, q) => {
    const selected = quizAnswers[q.id];
    const isCorrect = q.options.find((o) => o.id === selected)?.correct;
    return isCorrect ? score + 1 : score;
  }, 0);
  const isQuizPassed = quizScore >= 5;

  if (!isLoaded) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 text-foreground bg-background">
      <div className="mb-12">
        <h1 className="mb-4 text-4xl font-extrabold">spike.land Startup Checklist</h1>
        <p className="mb-8 text-lg text-muted-foreground">
          Reconciled roadmap and BAZDMEG verification for spike.land.
        </p>
        <div className="h-4 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all duration-500 ease-in-out"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
        <div className="mt-2 text-right text-sm font-medium">
          {completedCount} / {totalTasks} Tasks Completed
        </div>
      </div>

      <div className="space-y-8">
        {STAGES.map((stage) => {
          const stageTotal = stage.tasks.length;
          const stageCompleted = stage.tasks.filter((t) => completedTasks[t.id]).length;
          const stageProgress = (stageCompleted / stageTotal) * 100;

          return (
            <div
              key={stage.number}
              className="rounded-2xl border border-border bg-card p-6 shadow-sm"
            >
              <div className="mb-6">
                <h2 className="text-2xl font-bold">
                  Stage {stage.number}: <span className={stage.color}>{stage.title}</span>
                </h2>
                <div className="mt-4 flex items-center gap-4">
                  <div className="h-2 w-full flex-grow overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full ${stage.solidBg} transition-all duration-300`}
                      style={{ width: `${stageProgress}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                    {stageCompleted} / {stageTotal}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                {stage.tasks.map((task) => {
                  const isChecked = !!completedTasks[task.id];
                  return (
                    <button
                      key={task.id}
                      type="button"
                      className="group flex w-full cursor-pointer items-start gap-4 rounded-lg border border-transparent p-3 text-left hover:bg-muted/50 transition-colors"
                      onClick={() => toggleTask(task.id)}
                    >
                      <div className="pt-1">
                        <div
                          className={`flex h-5 w-5 items-center justify-center rounded border ${
                            isChecked
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-muted-foreground/30"
                          }`}
                        >
                          {isChecked && (
                            <svg
                              className="h-3 w-3"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={3}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </div>
                      </div>
                      <div className="flex-grow">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-mono text-xs text-muted-foreground">{task.id}</span>
                          <span
                            className={`text-base font-medium ${isChecked ? "text-muted-foreground line-through" : ""}`}
                          >
                            {task.title}
                          </span>
                          {task.source && (
                            <span
                              className={`rounded-full ${stage.bg} px-2 py-0.5 text-xs font-semibold ${stage.color}`}
                            >
                              {task.source}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-16 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-2 text-2xl font-bold">Planning Quiz</h2>
        <p className="mb-8 text-sm text-muted-foreground">
          BAZDMEG method verification. Test your understanding of this implementation.
        </p>

        <div className="space-y-8">
          {QUIZ_QUESTIONS.map((q, idx) => {
            const answered = quizAnswers[q.id];
            return (
              <div key={q.id} className="border-b border-border pb-8 last:border-0 last:pb-0">
                <h3 className="mb-4 text-lg font-medium">
                  {idx + 1}. {q.text}
                </h3>
                <div className="space-y-2">
                  {q.options.map((opt) => {
                    const isSelected = answered === opt.id;
                    const isCorrectOption = opt.correct;
                    const showCorrectness = !!answered;

                    let btnClass = "border-border hover:bg-muted/50";
                    if (showCorrectness) {
                      if (isSelected && isCorrectOption)
                        btnClass = "border-success bg-success/10 text-success-foreground";
                      else if (isSelected && !isCorrectOption)
                        btnClass =
                          "border-destructive bg-destructive/10 text-destructive-foreground";
                      else if (isCorrectOption)
                        btnClass = "border-success/50 border-dashed text-success-foreground";
                    }

                    return (
                      <button
                        key={opt.id}
                        disabled={!!answered}
                        onClick={() => handleQuizAnswer(q.id, opt.id)}
                        className={`w-full text-left rounded-lg border p-4 transition-colors ${btnClass}`}
                      >
                        <span className="font-bold mr-2">{opt.id})</span> {opt.text}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {Object.keys(quizAnswers).length === QUIZ_QUESTIONS.length && (
          <div
            className={`mt-8 rounded-xl p-6 text-center ${isQuizPassed ? "bg-success/10 text-success-foreground" : "bg-destructive/10 text-destructive-foreground"}`}
          >
            <div className="text-3xl font-bold mb-2">
              {quizScore} / {QUIZ_QUESTIONS.length}
            </div>
            <div className="text-lg font-medium">
              {isQuizPassed
                ? "Ready to implement. Proceed with confidence."
                : "Review the codebase before proceeding."}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SpikeLandStartChecklistPage;
