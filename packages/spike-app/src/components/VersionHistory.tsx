interface AppVersion {
  version: number;
  changeDescription: string;
  author?: string;
  timestamp: string;
}

interface VersionHistoryProps {
  versions: AppVersion[];
}

export function VersionHistory({ versions }: VersionHistoryProps) {
  const sorted = [...versions].sort((a, b) => b.version - a.version);
  const latest = sorted[0]?.version;

  if (sorted.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-gray-400">
        No versions yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sorted.map((v) => (
        <div
          key={v.version}
          className="flex items-start gap-3 rounded-lg border p-4"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
            v{v.version}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">{v.changeDescription}</p>
              {v.version === latest && (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                  Current
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
              {v.author && <span>{v.author}</span>}
              <span>{new Date(v.timestamp).toLocaleString()}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export type { AppVersion, VersionHistoryProps };
