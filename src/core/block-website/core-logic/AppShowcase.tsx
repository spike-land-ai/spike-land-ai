import { Link } from "../lazy-imports/link";
import { useDevModeCopy } from "../ui/useDevModeCopy";

const categories = [
  {
    name: "Developer Tools",
    description: "Build, test, and deploy with confidence.",
    apps: [
      { name: "qa-studio", label: "QA Studio", desc: "Automated browser testing", icon: "🧪" },
      { name: "spike-review", label: "Code Review", desc: "AI-powered code review", icon: "🔍" },
      { name: "esbuild-wasm", label: "Build Tools", desc: "Browser-based compilation", icon: "⚡" },
      { name: "state-machine", label: "State Machine", desc: "Visual workflow builder", icon: "⚙️" },
    ],
  },
  {
    name: "Creative & Media",
    description: "Create images, content, and more with AI.",
    apps: [
      {
        name: "mcp-image-studio",
        label: "Image Studio",
        desc: "AI image generation & editing",
        icon: "🎨",
      },
      { name: "hackernews-mcp", label: "HackerNews", desc: "Read & discuss tech news", icon: "📰" },
    ],
  },
  {
    name: "Games & Fun",
    description: "Play and compete.",
    apps: [
      {
        name: "chess-engine",
        label: "Chess Arena",
        desc: "Play chess against AI or friends",
        icon: "♟️",
      },
    ],
  },
];

export function AppShowcase() {
  const headingCopy = useDevModeCopy(
    "Ready-to-run apps for every workflow",
    "Composable surfaces for every developer workflow",
  );
  const bodyCopy = useDevModeCopy(
    "Whether you are building software, growing a brand, or creating art, spike.land has the apps you need, powered by AI.",
    "From browser automation to media generation and orchestration, spike.land exposes deployable capabilities instead of disconnected demos.",
  );
  const browseCopy = useDevModeCopy("Browse all tools", "Inspect all capabilities");

  return (
    <section aria-labelledby="showcase-heading" className="py-20 sm:py-24 border-t border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <header className="mb-16 text-center max-w-3xl mx-auto">
          <h2
            id="showcase-heading"
            className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-4"
          >
            {headingCopy.text}
          </h2>
          <p className="text-lg text-muted-foreground">{bodyCopy.text}</p>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {categories.map((category) => (
            <div key={category.name} className="flex flex-col">
              <h3 className="text-xl font-semibold mb-2 text-foreground">{category.name}</h3>
              <p className="text-sm text-muted-foreground mb-6">{category.description}</p>

              <ul className="space-y-3 flex-1">
                {category.apps.map((app) => (
                  <li key={app.name}>
                    <Link
                      href={`/tools/${app.name}`}
                      className="block p-4 rounded-xl border border-border/50 bg-muted/10 hover:bg-muted/40 hover:border-border hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-200 group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl" role="img" aria-label={app.name}>
                          {app.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-foreground group-hover:underline underline-offset-4 decoration-muted-foreground/50">
                            {app.label}
                          </div>
                          <div className="text-sm text-muted-foreground mt-0.5 truncate">
                            {app.desc}
                          </div>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        ...
        <div className="mt-16 text-center">
          <Link
            href="/tools"
            className="inline-flex items-center justify-center px-6 py-3 border border-border/50 bg-background text-foreground text-sm font-medium rounded-xl hover:bg-muted/30 hover:border-border hover:shadow-sm hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-200"
          >
            {browseCopy.text} &rarr;
          </Link>
        </div>
      </div>
    </section>
  );
}
