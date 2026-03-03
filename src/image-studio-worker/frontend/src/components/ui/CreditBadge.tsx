import { Zap } from "lucide-react";

interface CreditBadgeProps {
  cost: number;
  className?: string;
}

export function CreditBadge({ cost, className = "" }: CreditBadgeProps) {
  if (cost === 0) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs text-green-400 ${className}`}>
        FREE
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1 text-xs text-accent-400 ${className}`}>
      <Zap className="w-3 h-3" />
      {cost}
    </span>
  );
}
