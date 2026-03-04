import { Link } from "@tanstack/react-router";
import { Rocket, Shield, Zap, Layout, CheckCircle } from "lucide-react";

interface AppProductPageProps {
  appId: string;
}

const appMetadata: Record<string, {
  name: string;
  description: string;
  features: string[];
  photoUrl: string;
  ctaPrompt: string;
}> = {
  "qa-studio": {
    name: "QA Studio",
    description: "Automated QA testing with visual regression detection. Build and run end-to-end browser tests in seconds.",
    features: [
      "Multi-browser execution (Chromium, Firefox, WebKit)",
      "Visual regression detection with pixel-perfect comparison",
      "Automatic accessibility checks (Aria, Color Contrast)",
      "Lighthouse performance audits integrated into every run",
      "No-code test recording and maintenance"
    ],
    photoUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=1200&h=800",
    ctaPrompt: "Build a premium dark mode dashboard called QA Studio. It should record and run browser tests using Playwright."
  },
  "chess-engine": {
    name: "Chess Engine",
    description: "Play chess against an AI opponent with adjustable difficulty. Analyze your games and improve your strategy.",
    features: [
      "Adjustable AI difficulty (Stockfish integration)",
      "Real-time move analysis and blunder detection",
      "Beautiful custom themes and board layouts",
      "Online multiplayer and ELO tracking",
      "Game history and PGN export"
    ],
    photoUrl: "https://images.unsplash.com/photo-1529697210530-8c4bb1358ce5?auto=format&fit=crop&q=80&w=1200&h=800",
    ctaPrompt: "Build a competitive chess arena called Chess Engine. Integrate chess-game and arena MCPs."
  },
  "audio-mixer": {
    name: "Audio Mixer",
    description: "Mix and master audio tracks in the browser. A professional-grade DAW right in your web browser.",
    features: [
      "Multi-track audio editing and mixing",
      "Real-time effects and filters",
      "VST and Web Audio API support",
      "High-fidelity export options",
      "Collaborative session editing"
    ],
    photoUrl: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&q=80&w=1200&h=800",
    ctaPrompt: "Build a professional web-based audio editor called Audio Studio using the audio MCP."
  }
};

export function AppProductPage({ appId }: AppProductPageProps) {
  const meta = appMetadata[appId] || {
    name: appId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    description: "A powerful AI-native application built on the Spike Land platform.",
    features: [
      "Fast and responsive user interface",
      "Built-in AI assistance",
      "Real-time collaboration features",
      "Secure by design",
      "Easy to customize and extend"
    ],
    photoUrl: `https://picsum.photos/seed/${appId}/1200/800`,
    ctaPrompt: `Build an app called ${appId}.`
  };

  return (
    <div className="flex flex-col space-y-12 p-8 lg:p-12">
      {/* Hero Section */}
      <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-1.5 text-sm font-semibold text-blue-600">
            <Rocket className="h-4 w-4" />
            <span>Featured App</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl leading-tight">
            {meta.name}
          </h1>
          <p className="text-xl text-gray-500 leading-relaxed max-w-lg">
            {meta.description}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <Link
              to="/apps/new"
              search={{ prompt: meta.ctaPrompt }}
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-8 py-4 text-lg font-bold text-white shadow-lg transition hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98]"
            >
              Build This App
            </Link>
            <button
               onClick={() => {
                 // Trigger tab change to Preview via custom event
                 window.dispatchEvent(new CustomEvent('change-tab', { detail: 'Preview' }));
               }}
              className="inline-flex items-center justify-center rounded-xl border-2 border-gray-200 bg-white px-8 py-4 text-lg font-bold text-gray-700 transition hover:border-blue-600 hover:text-blue-600 active:scale-[0.98]"
            >
              Live Demo
            </button>
          </div>
        </div>

        <div className="relative group">
          <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-tr from-blue-500 to-cyan-500 opacity-20 blur-2xl transition group-hover:opacity-30"></div>
          <div className="relative overflow-hidden rounded-2xl border bg-gray-100 shadow-2xl">
            <img 
              src={meta.photoUrl} 
              alt={`${meta.name} Preview`} 
              className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 pt-12">
        {meta.features.map((feature, i) => (
          <div key={i} className="flex flex-col gap-4 rounded-2xl border bg-white p-6 shadow-sm transition hover:shadow-md hover:border-blue-100">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              {i % 4 === 0 && <Shield className="h-6 w-6" />}
              {i % 4 === 1 && <Zap className="h-6 w-6" />}
              {i % 4 === 2 && <Layout className="h-6 w-6" />}
              {i % 4 === 3 && <CheckCircle className="h-6 w-6" />}
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Feature {i + 1}</h3>
              <p className="mt-1 text-gray-500 leading-snug">{feature}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Trust Section */}
      <div className="rounded-3xl bg-zinc-950 p-12 text-center text-white shadow-xl">
        <h2 className="text-3xl font-bold mb-4">Built on the Spike Land Protocol</h2>
        <p className="text-zinc-400 max-w-2xl mx-auto mb-8 text-lg">
          Every app on Spike Land is fully autonomous, decentralized, and built on high-performance Cloudflare Workers.
        </p>
        <div className="flex flex-wrap justify-center gap-10 opacity-30 grayscale hover:opacity-100 hover:grayscale-0 transition duration-700 cursor-default">
           <div className="font-black text-2xl tracking-tighter italic">CLOUDFLARE</div>
           <div className="font-black text-2xl tracking-tighter italic text-orange-400">DURABLE OBJECTS</div>
           <div className="font-black text-2xl tracking-tighter italic text-cyan-400">R2 STORAGE</div>
           <div className="font-black text-2xl tracking-tighter italic text-blue-400">D1 SQL</div>
        </div>
      </div>
    </div>
  );
}
