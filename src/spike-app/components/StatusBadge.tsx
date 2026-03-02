type AppStatus = "prompting" | "drafting" | "building" | "live" | "archived" | "deleted";

const statusConfig: Record<AppStatus, { color: string; icon: string }> = {
  prompting: { color: "bg-yellow-100 text-yellow-700", icon: "?" },
  drafting: { color: "bg-blue-100 text-blue-700", icon: "\u270E" },
  building: { color: "bg-orange-100 text-orange-700", icon: "\u2699" },
  live: { color: "bg-green-100 text-green-700", icon: "\u25CF" },
  archived: { color: "bg-gray-100 text-gray-600", icon: "\u25A0" },
  deleted: { color: "bg-red-100 text-red-700", icon: "\u2715" },
};

interface StatusBadgeProps {
  status: AppStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.drafting;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.color}`}
    >
      <span className="text-[10px]">{config.icon}</span>
      {status}
    </span>
  );
}

export type { AppStatus };
