import { Link } from "../ui/link";

const categories = [
    {
        name: "For Builders & Ops",
        description: "Orchestrate workflows and run your infrastructure.",
        apps: [
            { name: "ai-orchestrator", desc: "Multi-agent workflows", icon: "🤖" },
            { name: "codespace", desc: "Cloud development environments", icon: "💻" },
            { name: "ops-dashboard", desc: "Infrastructure monitoring", icon: "📊" },
            { name: "qa-studio", desc: "Automated test generation", icon: "🧪" },
            { name: "state-machine", desc: "Complex logic flows", icon: "⚙️" }
        ]
    },
    {
        name: "For Founders & Growth",
        description: "Scale your business and manage your brand.",
        apps: [
            { name: "brand-command", desc: "Brand voice adherence", icon: "📣" },
            { name: "social-autopilot", desc: "Automated social presence", icon: "📱" },
            { name: "content-hub", desc: "Omnichannel distribution", icon: "📦" },
            { name: "career-navigator", desc: "Team growth and hiring", icon: "🚀" },
            { name: "app-creator", desc: "No-code app generation", icon: "✨" },
            { name: "page-builder", desc: "Instant landing pages", icon: "📄" }
        ]
    },
    {
        name: "For Creators & Gamers",
        description: "Unleash creativity and have fun.",
        apps: [
            { name: "image-studio", desc: "Advanced image generation", icon: "🎨" },
            { name: "music-creator", desc: "AI music composition", icon: "🎵" },
            { name: "audio-studio", desc: "Professional voice synthesis", icon: "🎙️" },
            { name: "chess-arena", desc: "Play against AI or humans", icon: "♟️" },
            { name: "tabletop-sim", desc: "Virtual tabletop sessions", icon: "🎲" },
            { name: "cleansweep", desc: "Digital organization", icon: "🧹" }
        ]
    }
];

export function AppShowcase() {
    return (
        <section
            aria-labelledby="showcase-heading"
            className="py-20 sm:py-24 border-t border-border"
        >
            <div className="max-w-6xl mx-auto px-4 sm:px-6">
                <header className="mb-16 text-center max-w-3xl mx-auto">
                    <h2
                        id="showcase-heading"
                        className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-4"
                    >
                        Ready-to-run apps for every workflow
                    </h2>
                    <p className="text-lg text-muted-foreground">
                        Whether you are building software, growing a brand, or creating art,
                        spike.land has the apps you need, powered by AI.
                    </p>
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
                                            className="block p-4 rounded-xl border border-border bg-muted/20 hover:bg-muted/50 hover:border-muted-foreground/30 transition-all hover:shadow-md group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="text-2xl" role="img" aria-label={app.name}>{app.icon}</span>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium text-foreground group-hover:underline underline-offset-4 decoration-muted-foreground/50">
                                                        {app.name}
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
                        className="inline-flex items-center justify-center px-6 py-3 border border-border text-foreground text-sm font-medium rounded-xl hover:bg-muted/50 transition-colors"
                    >
                        View all 80+ apps &rarr;
                    </Link>
                </div>
            </div>
        </section>
    );
}

