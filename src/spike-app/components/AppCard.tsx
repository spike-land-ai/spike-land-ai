import { Link } from "@tanstack/react-router";
import { StatusBadge, type AppStatus } from "./StatusBadge";

interface AppCardProps {
  id: string;
  name: string;
  description?: string;
  category?: string;
  status: AppStatus;
  ownerName?: string;
  createdAt?: string;
}

const categoryColors: Record<string, string> = {
  utility: "bg-purple-100 text-purple-700",
  game: "bg-pink-100 text-pink-700",
  tool: "bg-indigo-100 text-indigo-700",
  social: "bg-teal-100 text-teal-700",
  other: "bg-gray-100 text-gray-600",
};

export function AppCard({
  id,
  name,
  description,
  category,
  status,
  ownerName,
  createdAt,
}: AppCardProps) {
  return (
    <Link
      to="/apps/$appId"
      params={{ appId: id }}
      className="block rounded-xl border bg-white p-5 shadow-sm transition hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold leading-tight">{name}</h3>
        <StatusBadge status={status} />
      </div>
      {description && <p className="mt-2 line-clamp-2 text-sm text-gray-500">{description}</p>}
      <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
        {category && (
          <span
            className={`rounded-full px-2 py-0.5 font-medium ${categoryColors[category] ?? categoryColors.other}`}
          >
            {category}
          </span>
        )}
        {ownerName && <span>{ownerName}</span>}
        {createdAt && (
          <>
            <span>&middot;</span>
            <span>{new Date(createdAt).toLocaleDateString()}</span>
          </>
        )}
      </div>
    </Link>
  );
}

export type { AppCardProps };
