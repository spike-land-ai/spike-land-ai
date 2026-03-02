import { useState } from "react";

interface BadgeDisplayProps {
  token: string;
  topic: string;
  score: number;
  completedAt: string;
}

export function BadgeDisplay({ token, topic, score, completedAt }: BadgeDisplayProps) {
  const [copied, setCopied] = useState(false);

  const badgeUrl = `${window.location.origin}/learn/badge/${token}`;
  const scoreColor = score >= 80 ? "text-green-600" : score >= 60 ? "text-yellow-600" : "text-red-600";
  const scoreLabel = score >= 80 ? "Excellent" : score >= 60 ? "Good" : "Passing";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(badgeUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const input = document.createElement("input");
      input.value = badgeUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="mx-auto max-w-md rounded-2xl border bg-white p-8 shadow-lg">
      <div className="text-center">
        <div className="mb-4 text-5xl">🎓</div>
        <h2 className="text-xl font-bold text-gray-900">{topic}</h2>
        <div className={`mt-2 text-4xl font-extrabold ${scoreColor}`}>{score}%</div>
        <div className={`mt-1 text-sm font-semibold uppercase tracking-wide ${scoreColor}`}>
          {scoreLabel}
        </div>
        <p className="mt-3 text-sm text-gray-500">
          Completed {new Date(completedAt).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      <div className="mt-6 border-t pt-4">
        <label className="mb-1 block text-xs font-medium text-gray-500">Share this badge</label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={badgeUrl}
            className="flex-1 rounded-lg border bg-gray-50 px-3 py-2 text-xs text-gray-600"
          />
          <button
            onClick={handleCopy}
            className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-gray-400">
        Verified learning badge from spike.land
      </p>
    </div>
  );
}
