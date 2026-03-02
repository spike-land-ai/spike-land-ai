import { type FC } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, SPRING_CONFIGS, TYPOGRAPHY, VERITASIUM_COLORS } from "../../lib/constants";
import { stagger } from "../../lib/animations";

type NoteEntry = {
  label: string;
  tokens: number;
  confidence: number;
};

type TokenBudgetMeterProps = {
  notes: NoteEntry[];
  delay?: number;
};

const TOTAL_BUDGET = 800;
const BAR_WIDTH = 1400;
const BAR_HEIGHT = 56;

function getConfidenceColor(confidence: number): string {
  if (confidence > 0.6) return VERITASIUM_COLORS.active;
  if (confidence >= 0.3) return VERITASIUM_COLORS.candidate;
  return VERITASIUM_COLORS.deprecated;
}

export const TokenBudgetMeter: FC<TokenBudgetMeterProps> = ({ notes, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Sort notes by confidence descending so high-confidence ones are on the left
  const sortedNotes = [...notes].sort((a, b) => b.confidence - a.confidence);

  const totalUsed = sortedNotes.reduce((sum, n) => sum + n.tokens, 0);

  // Overall container fade in
  const containerProgress = spring({
    frame: frame - delay,
    fps,
    config: SPRING_CONFIGS.smooth,
  });

  // Animated counter
  const counterProgress = interpolate(frame - delay, [0, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const displayedTotal = Math.round(counterProgress * totalUsed);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 24,
        opacity: containerProgress,
      }}
    >
      {/* Header */}
      <div
        style={{
          fontFamily: TYPOGRAPHY.fontFamily.mono,
          fontSize: TYPOGRAPHY.fontSize["2xl"],
          color: COLORS.textSecondary,
        }}
      >
        Token Budget: {displayedTotal} / {TOTAL_BUDGET}
      </div>

      {/* Bar container */}
      <div style={{ position: "relative", width: BAR_WIDTH }}>
        {/* Labels above */}
        <div style={{ position: "relative", height: 28, marginBottom: 8 }}>
          {(() => {
            let offsetPx = 0;
            return sortedNotes.map((note, index) => {
              const segmentWidth = (note.tokens / TOTAL_BUDGET) * BAR_WIDTH;
              const labelX = offsetPx + segmentWidth / 2;
              offsetPx += segmentWidth;

              const itemDelay = delay + stagger(index, 8);
              const labelProgress = spring({
                frame: frame - itemDelay,
                fps,
                config: SPRING_CONFIGS.snappy,
              });

              return (
                <div
                  key={index}
                  style={{
                    position: "absolute",
                    left: labelX,
                    transform: "translateX(-50%)",
                    opacity: labelProgress,
                    fontFamily: TYPOGRAPHY.fontFamily.sans,
                    fontSize: TYPOGRAPHY.fontSize.sm,
                    color: COLORS.textPrimary,
                    whiteSpace: "nowrap",
                  }}
                >
                  {note.label}
                </div>
              );
            });
          })()}
        </div>

        {/* Background bar */}
        <div
          style={{
            width: BAR_WIDTH,
            height: BAR_HEIGHT,
            borderRadius: BAR_HEIGHT / 2,
            background: COLORS.darkCard,
            border: `1px solid ${COLORS.darkBorder}`,
            overflow: "hidden",
            display: "flex",
          }}
        >
          {sortedNotes.map((note, index) => {
            const itemDelay = delay + stagger(index, 8);
            const fillProgress = spring({
              frame: frame - itemDelay,
              fps,
              config: SPRING_CONFIGS.snappy,
            });

            const segmentWidth = (note.tokens / TOTAL_BUDGET) * BAR_WIDTH;
            const color = getConfidenceColor(note.confidence);

            return (
              <div
                key={index}
                style={{
                  width: segmentWidth * fillProgress,
                  height: "100%",
                  background: color,
                  opacity: 0.85,
                  borderRight:
                    index < sortedNotes.length - 1 ? `2px solid ${COLORS.darkBg}` : "none",
                }}
              />
            );
          })}
        </div>

        {/* Token counts below */}
        <div style={{ position: "relative", height: 24, marginTop: 8 }}>
          {(() => {
            let offsetPx = 0;
            return sortedNotes.map((note, index) => {
              const segmentWidth = (note.tokens / TOTAL_BUDGET) * BAR_WIDTH;
              const labelX = offsetPx + segmentWidth / 2;
              offsetPx += segmentWidth;

              const itemDelay = delay + stagger(index, 8);
              const labelProgress = spring({
                frame: frame - itemDelay,
                fps,
                config: SPRING_CONFIGS.snappy,
              });

              return (
                <div
                  key={index}
                  style={{
                    position: "absolute",
                    left: labelX,
                    transform: "translateX(-50%)",
                    opacity: labelProgress,
                    fontFamily: TYPOGRAPHY.fontFamily.mono,
                    fontSize: TYPOGRAPHY.fontSize.xs,
                    color: getConfidenceColor(note.confidence),
                  }}
                >
                  {note.tokens}t
                </div>
              );
            });
          })()}
        </div>
      </div>
    </div>
  );
};
