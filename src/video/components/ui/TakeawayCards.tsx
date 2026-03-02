import { type FC } from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, SPRING_CONFIGS, TYPOGRAPHY } from "../../lib/constants";
import { stagger } from "../../lib/animations";
import { GlassmorphismCard } from "./GlassmorphismCard";

type TakeawayCardsProps = {
  delay?: number;
};

const SpotlightIcon: FC<{ color: string }> = ({ color }) => (
  <svg width={48} height={48} viewBox="0 0 48 48" fill="none">
    <circle cx={24} cy={18} r={10} stroke={color} strokeWidth={2.5} fill="none" />
    <line x1={24} y1={28} x2={24} y2={40} stroke={color} strokeWidth={2.5} />
    <line x1={18} y1={36} x2={30} y2={36} stroke={color} strokeWidth={2.5} />
    {/* Rays */}
    <line x1={24} y1={4} x2={24} y2={6} stroke={color} strokeWidth={2} opacity={0.6} />
    <line x1={36} y1={10} x2={34.5} y2={11.5} stroke={color} strokeWidth={2} opacity={0.6} />
    <line x1={12} y1={10} x2={13.5} y2={11.5} stroke={color} strokeWidth={2} opacity={0.6} />
  </svg>
);

const FeedbackLoopIcon: FC<{ color: string }> = ({ color }) => (
  <svg width={48} height={48} viewBox="0 0 48 48" fill="none">
    <path
      d="M14 24a10 10 0 0 1 17.07-7.07"
      stroke={color}
      strokeWidth={2.5}
      fill="none"
      strokeLinecap="round"
    />
    <path
      d="M34 24a10 10 0 0 1-17.07 7.07"
      stroke={color}
      strokeWidth={2.5}
      fill="none"
      strokeLinecap="round"
    />
    {/* Arrow heads */}
    <path
      d="M30 14l3 3-4 1"
      stroke={color}
      strokeWidth={2}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M18 34l-3-3 4-1"
      stroke={color}
      strokeWidth={2}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const PuzzlePieceIcon: FC<{ color: string }> = ({ color }) => (
  <svg width={48} height={48} viewBox="0 0 48 48" fill="none">
    <path
      d="M20 12h8a2 2 0 0 1 2 2v4a4 4 0 1 1 0 8v4a2 2 0 0 1-2 2h-4a4 4 0 1 1-8 0h-4a2 2 0 0 1-2-2v-8a4 4 0 1 1 0-8V14a2 2 0 0 1 2-2h8z"
      stroke={color}
      strokeWidth={2.5}
      fill="none"
      strokeLinejoin="round"
    />
  </svg>
);

const TAKEAWAYS = [
  {
    Icon: SpotlightIcon,
    text: "Conserve your attention budget. Every token competes.",
    color: COLORS.cyan,
  },
  {
    Icon: FeedbackLoopIcon,
    text: "Build feedback loops, not bigger prompts. Evolution beats intelligent design.",
    color: COLORS.purple,
  },
  {
    Icon: PuzzlePieceIcon,
    text: "Match your tools to your task.",
    color: COLORS.amber,
  },
] as const;

export const TakeawayCards: FC<TakeawayCardsProps> = ({ delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div
      style={{
        display: "flex",
        gap: 40,
        alignItems: "flex-start",
        justifyContent: "center",
        width: "100%",
      }}
    >
      {TAKEAWAYS.map((takeaway, index) => {
        const itemDelay = delay + stagger(index, 12);
        const progress = spring({
          frame: frame - itemDelay,
          fps,
          config: SPRING_CONFIGS.snappy,
        });

        // Slight vertical offset for visual interest
        const verticalOffset = index === 1 ? -20 : 0;

        return (
          <div
            key={index}
            style={{
              transform: `translateY(${verticalOffset}px)`,
              opacity: progress,
            }}
          >
            <GlassmorphismCard width={480} delay={itemDelay} color={takeaway.color}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 24,
                  textAlign: "center",
                }}
              >
                <takeaway.Icon color={takeaway.color} />
                <p
                  style={{
                    fontSize: TYPOGRAPHY.fontSize.lg,
                    fontFamily: TYPOGRAPHY.fontFamily.sans,
                    color: COLORS.textPrimary,
                    lineHeight: 1.5,
                    margin: 0,
                  }}
                >
                  {takeaway.text}
                </p>
              </div>
            </GlassmorphismCard>
          </div>
        );
      })}
    </div>
  );
};
