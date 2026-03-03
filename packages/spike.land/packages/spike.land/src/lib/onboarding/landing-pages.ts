/**
 * Per-persona landing page content for all 16 onboarding personas.
 *
 * Each landing page provides targeted copy, pain points, feature highlights,
 * and a Brighton-flavoured message that speaks directly to the persona.
 */

export interface LandingPageContent {
  slug: string;
  headline: string;
  subheadline: string;
  painPoints: { title: string; description: string; }[];
  features: { title: string; description: string; appSlug: string; }[];
  brightonMessage: string;
  ctaLabel: string;
  ctaHref: string;
}

export const LANDING_PAGES: LandingPageContent[] = [
  // 1. AI Indie
  {
    slug: "ai-indie",
    headline: "Ship your AI product solo",
    subheadline:
      "You have the idea and the skills. Stop duct-taping APIs together and start shipping with tools that actually understand AI workflows.",
    painPoints: [
      {
        title: "Too many moving parts",
        description:
          "Wrangling LLM providers, vector stores, and deployment configs eats your entire weekend.",
      },
      {
        title: "No one to review your architecture",
        description:
          "Solo means no second opinion when your prompt chain starts hallucinating at 2 AM.",
      },
      {
        title: "Monitoring is an afterthought",
        description:
          "You ship fast but have zero visibility into what your AI is actually doing in production.",
      },
    ],
    features: [
      {
        title: "AI Orchestrator",
        description:
          "Wire up multi-model pipelines visually. Swap providers, add fallbacks, and test prompts without touching config files.",
        appSlug: "ai-orchestrator",
      },
      {
        title: "Codespace",
        description:
          "A browser-based editor that understands your stack. Write, test, and deploy without switching tabs.",
        appSlug: "codespace",
      },
      {
        title: "App Creator",
        description:
          "Scaffold full-stack AI apps from templates. Auth, database, and deployment sorted in minutes.",
        appSlug: "app-creator",
      },
      {
        title: "Ops Dashboard",
        description:
          "See your AI costs, latency, and error rates in one place. Catch regressions before your users do.",
        appSlug: "ops-dashboard",
      },
    ],
    brightonMessage:
      "Built by a solo dev in Brighton who got tired of paying enterprise prices for indie-sized problems. Everything here is free.",
    ctaLabel: "Start Building",
    ctaHref: "/store",
  },

  // 2. Classic Indie
  {
    slug: "classic-indie",
    headline: "From idea to launch, faster",
    subheadline:
      "You build real products with real code. No AI hype, no magic — just solid tools that help you ship and iterate.",
    painPoints: [
      {
        title: "Tooling fatigue",
        description:
          "Every month there is a new framework, a new bundler, a new way to do the same thing. You just want stability.",
      },
      {
        title: "Testing takes too long",
        description:
          "Writing tests feels like writing the app twice. So you skip them and pay for it later.",
      },
      {
        title: "Deployment complexity",
        description:
          "You spend more time on CI/CD pipelines than on the features your users actually want.",
      },
    ],
    features: [
      {
        title: "Codespace",
        description:
          "Write and run code in the browser with zero setup. Hot reload, TypeScript, and your favourite frameworks built in.",
        appSlug: "codespace",
      },
      {
        title: "App Creator",
        description:
          "Pick a template, customise it, deploy it. Full-stack scaffolding that respects your time.",
        appSlug: "app-creator",
      },
      {
        title: "Ops Dashboard",
        description:
          "Monitor uptime, track errors, and see real usage data without stitching together five SaaS tools.",
        appSlug: "ops-dashboard",
      },
      {
        title: "QA Studio",
        description:
          "Automated browser testing and accessibility audits. Write fewer tests but catch more bugs.",
        appSlug: "qa-studio",
      },
    ],
    brightonMessage:
      "Made in Brighton, where the rent is already expensive enough. That is why every tool here is completely free.",
    ctaLabel: "Ship It",
    ctaHref: "/store",
  },

  // 3. Agency Dev
  {
    slug: "agency-dev",
    headline: "Deliver client work on time",
    subheadline:
      "Juggling multiple clients, codebases, and deadlines? These tools help you deliver polished work without burning out.",
    painPoints: [
      {
        title: "Every client wants it yesterday",
        description:
          "Tight deadlines mean cutting corners on quality, which always comes back to haunt you.",
      },
      {
        title: "Context switching kills productivity",
        description:
          "Jumping between five different client projects means you never get into flow.",
      },
      {
        title: "QA is the first thing to go",
        description:
          "When the budget is tight, testing gets dropped. Then the bug reports start rolling in.",
      },
    ],
    features: [
      {
        title: "Codespace",
        description:
          "Spin up isolated environments per client. Switch projects in seconds, not minutes.",
        appSlug: "codespace",
      },
      {
        title: "Page Builder",
        description: "Build landing pages and marketing sites fast. Drag, drop, ship, invoice.",
        appSlug: "page-builder",
      },
      {
        title: "QA Studio",
        description:
          "Run automated cross-browser tests before every client handoff. Catch issues before they do.",
        appSlug: "qa-studio",
      },
      {
        title: "Brand Command",
        description:
          "Keep every client's brand consistent. Colours, fonts, logos — all managed in one place.",
        appSlug: "brand-command",
      },
    ],
    brightonMessage:
      "Brighton has a thriving freelance scene. We built these tools because we are part of it and know the grind.",
    ctaLabel: "Explore Tools",
    ctaHref: "/store",
  },

  // 4. In-house Dev
  {
    slug: "in-house-dev",
    headline: "Level up your dev workflow",
    subheadline:
      "You are shipping features at work but your tooling could be better. Get testing, monitoring, and collaboration tools without the procurement headache.",
    painPoints: [
      {
        title: "Legacy code everywhere",
        description:
          "Half the codebase was written by someone who left two years ago. Refactoring feels risky.",
      },
      {
        title: "Slow feedback loops",
        description:
          "CI takes 40 minutes. Code review takes two days. Shipping a one-line fix takes a week.",
      },
      {
        title: "Tooling budget is zero",
        description:
          "Your company will pay for Jira but not for the dev tools that actually make you productive.",
      },
    ],
    features: [
      {
        title: "Codespace",
        description:
          "A fast, browser-based editor for quick prototyping and debugging. No IT ticket required.",
        appSlug: "codespace",
      },
      {
        title: "QA Studio",
        description:
          "Automated testing and accessibility audits. Show your team lead the results, not just vibes.",
        appSlug: "qa-studio",
      },
      {
        title: "Ops Dashboard",
        description:
          "Track deployments, errors, and uptime. The monitoring your company should have but does not.",
        appSlug: "ops-dashboard",
      },
      {
        title: "State Machine",
        description:
          "Visualise and test complex business logic. Make that gnarly state management actually understandable.",
        appSlug: "state-machine",
      },
    ],
    brightonMessage:
      "We work from Brighton and believe good dev tools should not require a corporate credit card. Everything is free.",
    ctaLabel: "Get Started",
    ctaHref: "/store",
  },

  // 5. ML Engineer
  {
    slug: "ml-engineer",
    headline: "Deploy models with confidence",
    subheadline:
      "You train models that work in notebooks. Now ship them to production with proper orchestration, testing, and monitoring.",
    painPoints: [
      {
        title: "Notebook-to-production gap",
        description:
          "Your model works perfectly in Jupyter. Getting it into a reliable API endpoint is another story entirely.",
      },
      {
        title: "Monitoring model drift",
        description:
          "Your model was great at launch. Six months later, nobody knows if it is still performing well.",
      },
      {
        title: "Pipeline spaghetti",
        description:
          "Data ingestion, preprocessing, inference, post-processing — it is all held together with bash scripts.",
      },
    ],
    features: [
      {
        title: "AI Orchestrator",
        description:
          "Build production ML pipelines with proper error handling, retries, and fallback models.",
        appSlug: "ai-orchestrator",
      },
      {
        title: "Ops Dashboard",
        description:
          "Monitor inference latency, error rates, and model performance metrics in real time.",
        appSlug: "ops-dashboard",
      },
      {
        title: "Codespace",
        description:
          "Prototype and test model integrations in a browser-based environment. No local GPU required.",
        appSlug: "codespace",
      },
    ],
    brightonMessage:
      "Brighton may not be Silicon Valley, but we ship production ML tools from here — and we make them free for everyone.",
    ctaLabel: "Start Orchestrating",
    ctaHref: "/store",
  },

  // 6. AI Hobbyist
  {
    slug: "ai-hobbyist",
    headline: "Explore AI without the bill",
    subheadline:
      "You want to experiment with AI, build weird projects, and learn by doing. No PhD required, no credit card either.",
    painPoints: [
      {
        title: "API costs add up fast",
        description: "You want to experiment with GPT-4 and Claude but your wallet says otherwise.",
      },
      {
        title: "Tutorials are outdated instantly",
        description:
          "The blog post you are following was written six months ago. The API has changed three times since.",
      },
      {
        title: "Hard to go from experiment to app",
        description:
          "You got the prompt working in a playground but turning it into something real feels overwhelming.",
      },
    ],
    features: [
      {
        title: "AI Orchestrator",
        description:
          "Chain together different AI models and see what happens. Experiment visually without writing boilerplate.",
        appSlug: "ai-orchestrator",
      },
      {
        title: "Codespace",
        description:
          "Write and run AI experiments in the browser. Import libraries, test ideas, share results.",
        appSlug: "codespace",
      },
      {
        title: "App Creator",
        description:
          "Turn your AI experiment into an actual app. Templates get you from prompt to product.",
        appSlug: "app-creator",
      },
      {
        title: "State Machine",
        description:
          "Visualise your AI agent's decision logic. Debug why it chose path A instead of path B.",
        appSlug: "state-machine",
      },
    ],
    brightonMessage:
      "We tinker with AI from our desks overlooking the Brighton seafront. This platform is our playground — and now it is yours too.",
    ctaLabel: "Start Exploring",
    ctaHref: "/store",
  },

  // 7. Enterprise DevOps
  {
    slug: "enterprise-devops",
    headline: "Ops tools that scale with you",
    subheadline:
      "Your org has hundreds of services, complex pipelines, and compliance requirements. Get visibility and control without another enterprise contract.",
    painPoints: [
      {
        title: "Alert fatigue is real",
        description:
          "You get 200 alerts a day. Most are noise. Finding the signal takes hours you do not have.",
      },
      {
        title: "Too many dashboards",
        description:
          "Datadog, Grafana, CloudWatch, PagerDuty — you spend more time switching tools than fixing issues.",
      },
      {
        title: "Change management slows everything",
        description:
          "Deploying a config change requires three approvals, two meetings, and a prayer.",
      },
    ],
    features: [
      {
        title: "Ops Dashboard",
        description:
          "Unified monitoring across services. One view for deployments, errors, and infrastructure health.",
        appSlug: "ops-dashboard",
      },
      {
        title: "QA Studio",
        description:
          "Automated regression testing that runs on every deploy. Catch breaking changes before production.",
        appSlug: "qa-studio",
      },
      {
        title: "AI Orchestrator",
        description: "Automate incident response and runbook execution with AI-powered pipelines.",
        appSlug: "ai-orchestrator",
      },
      {
        title: "State Machine",
        description:
          "Model and validate complex deployment workflows. Visualise every state transition before it happens.",
        appSlug: "state-machine",
      },
    ],
    brightonMessage:
      "We are a small team in Brighton punching above our weight. Enterprise-grade tools, zero enterprise pricing.",
    ctaLabel: "Explore Platform",
    ctaHref: "/store",
  },

  // 8. Startup DevOps
  {
    slug: "startup-devops",
    headline: "Move fast, break nothing",
    subheadline:
      "Your startup needs speed but you cannot afford downtime. Get startup-friendly ops tools that do not cost a fortune.",
    painPoints: [
      {
        title: "You are the entire ops team",
        description:
          "There is no SRE team. There is you, a Slack channel, and a lot of YAML files.",
      },
      {
        title: "Free tiers run out fast",
        description:
          "Every monitoring tool is free until you actually need it. Then it is 400 quid a month.",
      },
      {
        title: "Technical debt compounds daily",
        description:
          "You shipped it fast to hit the deadline. Now the deployment pipeline is held together with hope.",
      },
    ],
    features: [
      {
        title: "Ops Dashboard",
        description:
          "See everything that matters — uptime, errors, deploys — in one lightweight dashboard.",
        appSlug: "ops-dashboard",
      },
      {
        title: "Codespace",
        description:
          "Debug production issues from anywhere. Browser-based, fast, no local setup needed.",
        appSlug: "codespace",
      },
      {
        title: "QA Studio",
        description:
          "Automated testing that catches regressions. Because manually testing before every deploy does not scale.",
        appSlug: "qa-studio",
      },
    ],
    brightonMessage:
      "Built by startup people in Brighton who have been the solo DevOps person. We feel your pain. It is all free.",
    ctaLabel: "Get Started",
    ctaHref: "/store",
  },

  // 9. Technical Founder
  {
    slug: "technical-founder",
    headline: "Build your business, not just code",
    subheadline:
      "You can write the code. The hard part is everything else — branding, marketing, growth. Get tools that cover the whole picture.",
    painPoints: [
      {
        title: "Coding is the easy part",
        description:
          "You built the product in a weekend. Getting anyone to notice it has taken six months.",
      },
      {
        title: "Marketing feels like a foreign language",
        description:
          "You know React hooks inside out but writing a landing page headline makes your brain hurt.",
      },
      {
        title: "Wearing every hat",
        description:
          "CEO, CTO, head of marketing, customer support. You switch roles ten times before lunch.",
      },
    ],
    features: [
      {
        title: "App Creator",
        description:
          "Scaffold and deploy your product fast. Templates for SaaS, marketplaces, and more.",
        appSlug: "app-creator",
      },
      {
        title: "Brand Command",
        description:
          "Build a real brand identity. Logo, colours, tone of voice — sorted in an afternoon.",
        appSlug: "brand-command",
      },
      {
        title: "Social Autopilot",
        description:
          "Schedule and publish content across platforms. Grow your audience while you write code.",
        appSlug: "social-autopilot",
      },
      {
        title: "Ops Dashboard",
        description:
          "Monitor your product health. Know when things break before your users tweet about it.",
        appSlug: "ops-dashboard",
      },
    ],
    brightonMessage:
      "Brighton is full of founders hustling from co-working spaces and coffee shops. We built this for you — and it costs nothing.",
    ctaLabel: "Build Your Business",
    ctaHref: "/store",
  },

  // 10. Non-technical Founder
  {
    slug: "nontechnical-founder",
    headline: "Launch without writing code",
    subheadline:
      "You have the vision and the drive. You should not need a developer to build your first landing page, app, or brand.",
    painPoints: [
      {
        title: "Hiring a developer is expensive",
        description:
          "A simple app quote comes back at five figures. You have not even validated the idea yet.",
      },
      {
        title: "No-code tools feel limiting",
        description:
          "Wix and Squarespace get you started but you hit walls the moment you want something custom.",
      },
      {
        title: "Branding on a budget",
        description:
          "You know your brand needs to look professional but a design agency is not in the budget.",
      },
    ],
    features: [
      {
        title: "App Creator",
        description:
          "Build functional apps with guided templates. No code, no jargon, just your idea coming to life.",
        appSlug: "app-creator",
      },
      {
        title: "Page Builder",
        description:
          "Drag and drop your way to a beautiful landing page. Publish in minutes, iterate on the fly.",
        appSlug: "page-builder",
      },
      {
        title: "Brand Command",
        description:
          "Create a cohesive brand identity with AI guidance. Logos, colour palettes, and style guides.",
        appSlug: "brand-command",
      },
      {
        title: "Social Autopilot",
        description:
          "Schedule social media posts and grow your audience. Focus on your business, not the algorithm.",
        appSlug: "social-autopilot",
      },
    ],
    brightonMessage:
      "We are based in Brighton and believe the best ideas should not be blocked by technical barriers. Everything is free to use.",
    ctaLabel: "Get Started",
    ctaHref: "/store",
  },

  // 11. Growth Leader
  {
    slug: "growth-leader",
    headline: "Scale your reach, not your costs",
    subheadline:
      "You need to grow revenue, build brand awareness, and develop your team — without adding more headcount or more tools.",
    painPoints: [
      {
        title: "Content takes forever",
        description:
          "Your team spends days creating content that gets three likes. The ROI on social media feels broken.",
      },
      {
        title: "Brand consistency is a myth",
        description:
          "Every team member uses different fonts, colours, and messaging. Your brand looks like it has multiple personalities.",
      },
      {
        title: "Talent retention is a grind",
        description:
          "Growing the team means keeping the team. Career development tools are expensive or non-existent.",
      },
    ],
    features: [
      {
        title: "Social Autopilot",
        description:
          "Automate your social media presence. Schedule, publish, and analyse — across every platform.",
        appSlug: "social-autopilot",
      },
      {
        title: "Brand Command",
        description:
          "Centralise your brand guidelines. Everyone on your team uses the right assets, every time.",
        appSlug: "brand-command",
      },
      {
        title: "Content Hub",
        description:
          "Plan, create, and distribute content from one place. Kill the spreadsheet-based content calendar.",
        appSlug: "content-hub",
      },
      {
        title: "Career Navigator",
        description:
          "Help your team map career paths and develop skills. Retention starts with growth opportunities.",
        appSlug: "career-navigator",
      },
    ],
    brightonMessage:
      "From our office near the Brighton Lanes, we are building growth tools for leaders who think big but spend smart.",
    ctaLabel: "Grow Your Reach",
    ctaHref: "/orbit",
  },

  // 12. Ops Leader
  {
    slug: "ops-leader",
    headline: "Streamline your team's workflow",
    subheadline:
      "You are responsible for making sure everything runs smoothly. Get dashboards, automation, and content tools that actually reduce your workload.",
    painPoints: [
      {
        title: "Too many tools, not enough integration",
        description:
          "Your team uses 15 different SaaS products. None of them talk to each other properly.",
      },
      {
        title: "Reporting takes half your Monday",
        description:
          "Pulling numbers from five dashboards into a slide deck is not strategic work. It is busywork.",
      },
      {
        title: "Process documentation is always stale",
        description:
          "The wiki was last updated eight months ago. New hires figure things out by asking in Slack.",
      },
    ],
    features: [
      {
        title: "Ops Dashboard",
        description:
          "One unified view of your team's operations. Deployments, incidents, and KPIs in one place.",
        appSlug: "ops-dashboard",
      },
      {
        title: "Brand Command",
        description:
          "Keep internal and external communications on-brand. Templates, assets, and guidelines centralised.",
        appSlug: "brand-command",
      },
      {
        title: "Social Autopilot",
        description:
          "Manage your company's social presence efficiently. Schedule posts and track engagement without the chaos.",
        appSlug: "social-autopilot",
      },
      {
        title: "Content Hub",
        description:
          "Centralise your team's documentation and content. Keep it current, searchable, and accessible.",
        appSlug: "content-hub",
      },
    ],
    brightonMessage:
      "We run our own ops from Brighton and built the tools we wished existed. Free for teams of every size.",
    ctaLabel: "Optimize Now",
    ctaHref: "/store",
  },

  // 13. Content Creator
  {
    slug: "content-creator",
    headline: "Create and publish, your way",
    subheadline:
      "You have an audience waiting. Stop wrestling with expensive software and start creating with tools that respect your creative process.",
    painPoints: [
      {
        title: "Software costs eat your revenue",
        description:
          "Adobe, Canva Pro, a DAW, hosting — the monthly subscriptions add up to more than some people earn from creating.",
      },
      {
        title: "Workflow is fragmented",
        description:
          "You edit images in one app, build pages in another, make music in a third. Nothing connects.",
      },
      {
        title: "Publishing is a pain",
        description:
          "Getting your content from creation to published on your site takes way too many steps.",
      },
    ],
    features: [
      {
        title: "Pixel Studio",
        description:
          "Create and edit images with AI-powered tools. Thumbnails, banners, and social graphics in minutes.",
        appSlug: "pixel-studio",
      },
      {
        title: "Page Builder",
        description:
          "Build beautiful portfolio pages and landing pages. Showcase your work the way you want.",
        appSlug: "page-builder",
      },
      {
        title: "Music Creator",
        description:
          "Compose background music, intros, and sound effects. No music theory degree needed.",
        appSlug: "music-creator",
      },
      {
        title: "Audio Studio",
        description:
          "Record, edit, and master audio. Podcasts, voiceovers, and music production in the browser.",
        appSlug: "audio-studio",
      },
    ],
    brightonMessage:
      "Brighton has always been a creative city. We built these tools here for creators who would rather spend on gear than software.",
    ctaLabel: "Start Creating",
    ctaHref: "/store",
  },

  // 14. Hobbyist Creator
  {
    slug: "hobbyist-creator",
    headline: "Create for the joy of it",
    subheadline:
      "No deadlines, no clients, no metrics. Just you making things because it feels good. Art, music, design — all free.",
    painPoints: [
      {
        title: "Creative software is absurdly expensive",
        description:
          "You just want to make art on weekends. Paying 50 quid a month for Adobe does not make sense.",
      },
      {
        title: "Learning curves kill the fun",
        description:
          "You downloaded Blender. You watched a 4-hour tutorial. You made a grey cube. The fun is gone.",
      },
      {
        title: "Nowhere to keep your creations",
        description:
          "Your art lives in random folders. You have no portfolio, no gallery, no way to look back at what you have made.",
      },
    ],
    features: [
      {
        title: "Pixel Studio",
        description:
          "Draw, paint, and generate images with approachable tools. Complex enough to grow with you, simple enough to start now.",
        appSlug: "pixel-studio",
      },
      {
        title: "Music Creator",
        description:
          "Make music by layering loops, instruments, and effects. No theory required — just play.",
        appSlug: "music-creator",
      },
      {
        title: "Audio Studio",
        description:
          "Record and mix audio right in the browser. Perfect for podcasts, sound experiments, or just messing about.",
        appSlug: "audio-studio",
      },
      {
        title: "Page Builder",
        description:
          "Build a personal gallery or portfolio to showcase your creations. Share them with friends or keep them private.",
        appSlug: "page-builder",
      },
    ],
    brightonMessage:
      "Brighton is a city that celebrates making things for the sake of it. This platform is our contribution. Totally free.",
    ctaLabel: "Start Creating",
    ctaHref: "/store",
  },

  // 15. Social Gamer
  {
    slug: "social-gamer",
    headline: "Play together, from anywhere",
    subheadline:
      "Chess, tabletop games, and more — all in the browser. No downloads, no accounts, no hassle. Just grab a friend and play.",
    painPoints: [
      {
        title: "Game night logistics are painful",
        description:
          "Coordinating schedules, finding a platform everyone has, downloading yet another app — it kills the vibe.",
      },
      {
        title: "Online games are full of strangers",
        description:
          "You want to play with your mates, not get matched with random people who rage quit after two moves.",
      },
      {
        title: "Board game apps are expensive or ugly",
        description:
          "The good tabletop simulators cost money. The free ones look like they were built in 2005.",
      },
    ],
    features: [
      {
        title: "Chess Arena",
        description:
          "Play rated chess against friends or find a match. Clean interface, ELO tracking, no ads.",
        appSlug: "chess-arena",
      },
      {
        title: "Tabletop Simulator",
        description:
          "Set up a virtual table for board games, card games, and RPGs. Invite friends with a link.",
        appSlug: "tabletop-sim",
      },
      {
        title: "Display Wall",
        description:
          "Share a screen with your group for game nights. Leaderboards, timers, and shared views.",
        appSlug: "display-wall",
      },
      {
        title: "Music Creator",
        description:
          "Set the mood with background music for your game sessions. Create playlists or generate ambient tracks.",
        appSlug: "music-creator",
      },
    ],
    brightonMessage:
      "Board game culture is huge in Brighton. We built this so game night can happen even when your mates are not in the same city.",
    ctaLabel: "Find a Game",
    ctaHref: "/apps/chess-arena",
  },

  // 16. Solo Explorer
  {
    slug: "solo-explorer",
    headline: "Discover something new today",
    subheadline:
      "Not sure what you are looking for yet? Explore tools for organising your life, making art, creating music, and finding your next career move.",
    painPoints: [
      {
        title: "Too many apps, too little time",
        description:
          "You have 200 apps on your phone and use about five of them. Finding the right tool for anything feels exhausting.",
      },
      {
        title: "Free trials are a trap",
        description:
          "You sign up, forget to cancel, and suddenly you are paying for something you used once.",
      },
      {
        title: "Starting something new is intimidating",
        description:
          "You want to learn music, try art, or explore a career change — but where do you even begin?",
      },
    ],
    features: [
      {
        title: "CleanSweep",
        description:
          "Gamified tidying and organisation. Turn boring chores into something oddly satisfying.",
        appSlug: "cleansweep",
      },
      {
        title: "Pixel Studio",
        description:
          "Try digital art with zero pressure. Draw, paint, or generate images — see what clicks.",
        appSlug: "pixel-studio",
      },
      {
        title: "Music Creator",
        description:
          "Make music without any musical background. Layer sounds, experiment with loops, surprise yourself.",
        appSlug: "music-creator",
      },
      {
        title: "Career Navigator",
        description:
          "Explore career paths, map your skills, and figure out your next move with guided tools.",
        appSlug: "career-navigator",
      },
    ],
    brightonMessage:
      "We are based in Brighton — a city built on curiosity and doing your own thing. Explore everything here for free.",
    ctaLabel: "Start Exploring",
    ctaHref: "/store",
  },
];

/**
 * Look up a landing page by persona slug.
 */
export function getLandingPageBySlug(
  slug: string,
): LandingPageContent | undefined {
  return LANDING_PAGES.find(lp => lp.slug === slug);
}
