interface ConceptProgress {
  concept: string;
  mastered: boolean;
  correctCount: number;
  attempts: number;
}

interface QuizProgressProps {
  progress: ConceptProgress[];
  masteryThreshold?: number;
}

export function QuizProgress({ progress, masteryThreshold = 2 }: QuizProgressProps) {
  const masteredCount = progress.filter((p) => p.mastered).length;

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Concept Mastery
        </h3>
        <span className="text-sm font-medium text-gray-600">
          {masteredCount}/{progress.length} mastered
        </span>
      </div>

      {/* Overall progress bar */}
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-blue-600 transition-all duration-500"
          style={{ width: `${progress.length > 0 ? (masteredCount / progress.length) * 100 : 0}%` }}
        />
      </div>

      {/* Per-concept progress */}
      <div className="space-y-3">
        {progress.map((p) => (
          <div key={p.concept} className="flex items-center gap-3">
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
                p.mastered
                  ? "bg-green-100 text-green-700"
                  : p.correctCount > 0
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-gray-100 text-gray-400"
              }`}
            >
              {p.mastered ? "✓" : p.correctCount}
            </span>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">{p.concept}</span>
                <span className="text-xs text-gray-400">
                  {p.correctCount}/{masteryThreshold}
                </span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    p.mastered ? "bg-green-500" : "bg-blue-400"
                  }`}
                  style={{ width: `${Math.min((p.correctCount / masteryThreshold) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
