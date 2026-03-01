import { AppCard } from "@/components/AppCard";
import type { AppStatus } from "@/components/StatusBadge";

interface StoreApp {
  id: string;
  name: string;
  description: string;
  status: AppStatus;
  category: string;
  ownerName: string;
  installs: number;
}

const storeApps: StoreApp[] = [
  {
    id: "chess-engine",
    name: "Chess Engine",
    description: "Play chess against AI",
    status: "live",
    category: "game",
    ownerName: "spike-team",
    installs: 1200,
  },
  {
    id: "qa-studio",
    name: "QA Studio",
    description: "Automated QA testing",
    status: "live",
    category: "tool",
    ownerName: "spike-team",
    installs: 890,
  },
  {
    id: "audio-mixer",
    name: "Audio Mixer",
    description: "Mix and master audio tracks",
    status: "live",
    category: "utility",
    ownerName: "community",
    installs: 340,
  },
  {
    id: "markdown-editor",
    name: "Markdown Editor",
    description: "Rich markdown editing",
    status: "live",
    category: "tool",
    ownerName: "community",
    installs: 560,
  },
  {
    id: "data-viz",
    name: "Data Viz",
    description: "Interactive data visualization",
    status: "live",
    category: "utility",
    ownerName: "spike-team",
    installs: 720,
  },
  {
    id: "code-review",
    name: "Code Review",
    description: "AI-powered code reviews",
    status: "live",
    category: "tool",
    ownerName: "community",
    installs: 450,
  },
];

export function StorePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">App Store</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {storeApps.map((app) => (
          <AppCard
            key={app.id}
            id={app.id}
            name={app.name}
            description={app.description}
            status={app.status}
            category={app.category}
            ownerName={app.ownerName}
          />
        ))}
      </div>
    </div>
  );
}
