import { motion } from "framer-motion";

const principles = [
  {
    id: 1,
    title: "Requirements Are The Product",
    subtitle: "The code is just the output",
    desc: "Define exactly what you want before writing a single line of code. If the AI doesn't know what it's building, it will build something you don't want.",
    icon: "📝",
    color: "from-blue-500/20 to-cyan-500/20",
    border: "border-blue-500/30",
  },
  {
    id: 2,
    title: "Discipline Before Automation",
    subtitle: "You cannot automate chaos",
    desc: "If your CI takes 20 minutes and half your tests are flaky, AI agents will only help you generate bugs faster. Fix your pipeline first.",
    icon: "⚙️",
    color: "from-red-500/20 to-orange-500/20",
    border: "border-red-500/30",
  },
  {
    id: 3,
    title: "Context Is Architecture",
    subtitle: "What the model knows when you ask",
    desc: "Curate your context window. Send the right files, the right docs, and the right constraints. Good context beats a big model.",
    icon: "🧠",
    color: "from-purple-500/20 to-fuchsia-500/20",
    border: "border-purple-500/30",
  },
  {
    id: 4,
    title: "Test The Lies",
    subtitle: "Unit tests, E2E tests, agent tests",
    desc: "LLMs are incredibly convincing liars. Trust nothing they generate until it is verified by an automated test running in CI.",
    icon: "🧪",
    color: "from-green-500/20 to-emerald-500/20",
    border: "border-green-500/30",
  },
  {
    id: 5,
    title: "Orchestrate, Do Not Operate",
    subtitle: "Coordinate agents, not keystrokes",
    desc: "Stop writing code. Start writing prompts, reviewing plans, and composing specialized agents to do the heavy lifting for you.",
    icon: "🎼",
    color: "from-indigo-500/20 to-blue-500/20",
    border: "border-indigo-500/30",
  },
  {
    id: 6,
    title: "Trust Is Earned In PRs",
    subtitle: "Not in promises, not in demos",
    desc: "Treat AI-generated code exactly like code from a new intern. Review it rigorously. Put it through the same quality gates.",
    icon: "🤝",
    color: "from-yellow-500/20 to-amber-500/20",
    border: "border-yellow-500/30",
  },
  {
    id: 7,
    title: "Own What You Ship",
    subtitle: "If you cannot explain it at 3am, do not ship it",
    desc: "You are responsible for every line of code your agents push to production. Understand it deeply before you merge it.",
    icon: "👑",
    color: "from-rose-500/20 to-pink-500/20",
    border: "border-rose-500/30",
  },
  {
    id: 8,
    title: "Sources Have Rank",
    subtitle: "Canonical spec > audit > chat",
    desc: "When resolving conflicts, the canonical specification always wins. Never let a chat session override your core architecture documents.",
    icon: "📚",
    color: "from-teal-500/20 to-emerald-500/20",
    border: "border-teal-500/30",
  },
];

export function PrinciplesList() {
  return (
    <section id="principles" className="py-24 bg-background/50">
      <div className="container mx-auto px-4">
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-5xl mb-4">The 8 Core Principles</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            These guidelines shape how we interact with LLMs, ensuring high-quality output and maintainable codebases.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {principles.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              whileHover={{ y: -5, scale: 1.02 }}
              className={`relative flex flex-col rounded-2xl border ${p.border} bg-gradient-to-br ${p.color} p-6 shadow-sm backdrop-blur-sm transition-all hover:shadow-md`}
            >
              <div className="mb-4 text-4xl">{p.icon}</div>
              <div className="mb-2 text-sm font-bold text-primary opacity-80">Principle {p.id}</div>
              <h3 className="mb-1 text-xl font-bold leading-tight">{p.title}</h3>
              <div className="mb-3 text-sm font-medium italic opacity-70">{p.subtitle}</div>
              <p className="mt-auto text-sm leading-relaxed text-muted-foreground">{p.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
