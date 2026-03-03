interface MatchBadgeProps {
  score: number;
}

export function MatchBadge({ score }: MatchBadgeProps) {
  let color: string;
  if (score >= 70) {
    color = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  } else if (score >= 40) {
    color = "bg-amber-500/20 text-amber-400 border-amber-500/30";
  } else color = "bg-red-500/20 text-red-400 border-red-500/30";

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${color}`}
    >
      {score}%
    </span>
  );
}
