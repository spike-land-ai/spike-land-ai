import { Link } from "@tanstack/react-router";
import { AppCard } from "@/components/AppCard";
import type { AppStatus } from "@/components/StatusBadge";

interface PlaceholderApp {
  id: string;
  name: string;
  description: string;
  status: AppStatus;
  category: string;
  ownerName: string;
  createdAt: string;
}

const placeholderApps: PlaceholderApp[] = [
  {
    id: "chess-engine",
    name: "Chess Engine",
    description: "Play chess against an AI opponent with adjustable difficulty",
    status: "live",
    category: "game",
    ownerName: "spike-team",
    createdAt: "2025-12-01T00:00:00Z",
  },
  {
    id: "qa-studio",
    name: "QA Studio",
    description: "Automated QA testing with visual regression detection",
    status: "live",
    category: "tool",
    ownerName: "spike-team",
    createdAt: "2025-11-15T00:00:00Z",
  },
  {
    id: "audio-mixer",
    name: "Audio Mixer",
    description: "Mix and master audio tracks in the browser",
    status: "drafting",
    category: "utility",
    ownerName: "community",
    createdAt: "2026-01-10T00:00:00Z",
  },
];

export function AppsIndexPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Apps</h1>
        <Link
          to="/apps/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          Create App
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {placeholderApps.map((app) => (
          <AppCard
            key={app.id}
            id={app.id}
            name={app.name}
            description={app.description}
            status={app.status}
            category={app.category}
            ownerName={app.ownerName}
            createdAt={app.createdAt}
          />
        ))}
      </div>
    </div>
  );
}
