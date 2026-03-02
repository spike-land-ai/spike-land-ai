import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, SPRING_CONFIGS, TYPOGRAPHY } from "../../lib/constants";

type ReviewerAgentCardProps = {
  name: string;
  model: string;
  elo: number;
  wins: number;
  losses: number;
  color?: string;
  delay?: number;
};

export function ReviewerAgentCard({
  name,
  model,
  elo,
  wins,
  losses,
  color = COLORS.cyan,
  delay = 0,
}: ReviewerAgentCardProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - delay,
    fps,
    config: SPRING_CONFIGS.snappy,
  });

  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const winRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;

  return (
    <div
      style={{
        width: 320,
        padding: 24,
        background: COLORS.darkCard,
        border: `1px solid ${COLORS.darkBorder}`,
        borderRadius: 16,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        transform: `scale(${progress}) translateY(${(1 - progress) * 20}px)`,
        opacity: progress,
        boxShadow: `0 8px 32px rgba(0,0,0,0.4)`,
      }}
    >
      {/* Header: Avatar + Name */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {/* Avatar circle */}
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            background: `${color}20`,
            border: `2px solid ${color}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: TYPOGRAPHY.fontSize.xl,
            fontWeight: 700,
            color,
            fontFamily: TYPOGRAPHY.fontFamily.sans,
          }}
        >
          {initials}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div
            style={{
              fontSize: TYPOGRAPHY.fontSize.lg,
              fontWeight: 700,
              color: COLORS.textPrimary,
              fontFamily: TYPOGRAPHY.fontFamily.sans,
            }}
          >
            {name}
          </div>
          <div
            style={{
              fontSize: TYPOGRAPHY.fontSize.sm,
              color: COLORS.textMuted,
              fontFamily: TYPOGRAPHY.fontFamily.mono,
            }}
          >
            {model}
          </div>
        </div>
      </div>

      {/* ELO Badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            padding: "6px 16px",
            borderRadius: 20,
            background: `${color}20`,
            border: `1px solid ${color}60`,
            fontSize: TYPOGRAPHY.fontSize["2xl"],
            fontWeight: 700,
            color,
            fontFamily: TYPOGRAPHY.fontFamily.mono,
          }}
        >
          {elo}
        </div>
        <div
          style={{
            fontSize: TYPOGRAPHY.fontSize.sm,
            color: COLORS.textMuted,
            fontFamily: TYPOGRAPHY.fontFamily.sans,
          }}
        >
          ELO Rating
        </div>
      </div>

      {/* Win/Loss Record */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "12px 0 0 0",
          borderTop: `1px solid ${COLORS.darkBorder}`,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
          }}
        >
          <div
            style={{
              fontSize: TYPOGRAPHY.fontSize.xl,
              fontWeight: 700,
              color: COLORS.success,
              fontFamily: TYPOGRAPHY.fontFamily.mono,
            }}
          >
            {wins}
          </div>
          <div
            style={{
              fontSize: TYPOGRAPHY.fontSize.xs,
              color: COLORS.textMuted,
              fontFamily: TYPOGRAPHY.fontFamily.sans,
            }}
          >
            Wins
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
          }}
        >
          <div
            style={{
              fontSize: TYPOGRAPHY.fontSize.xl,
              fontWeight: 700,
              color: COLORS.error,
              fontFamily: TYPOGRAPHY.fontFamily.mono,
            }}
          >
            {losses}
          </div>
          <div
            style={{
              fontSize: TYPOGRAPHY.fontSize.xs,
              color: COLORS.textMuted,
              fontFamily: TYPOGRAPHY.fontFamily.sans,
            }}
          >
            Losses
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
          }}
        >
          <div
            style={{
              fontSize: TYPOGRAPHY.fontSize.xl,
              fontWeight: 700,
              color: COLORS.textPrimary,
              fontFamily: TYPOGRAPHY.fontFamily.mono,
            }}
          >
            {winRate}%
          </div>
          <div
            style={{
              fontSize: TYPOGRAPHY.fontSize.xs,
              color: COLORS.textMuted,
              fontFamily: TYPOGRAPHY.fontFamily.sans,
            }}
          >
            Win Rate
          </div>
        </div>
      </div>
    </div>
  );
}
