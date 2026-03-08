import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, SPRING_CONFIGS } from "../../../core-logic/constants";
import { pulse } from "../../lib/animations";

type StatusBadgeProps = {
  status: "generating" | "published" | "live";
  delay?: number;
};

const STATUS_STYLES = {
  generating: { bg: COLORS.amber, label: "generating" },
  published: { bg: COLORS.success, label: "published" },
  live: { bg: COLORS.cyan, label: "live" },
} as const;

export function StatusBadge({ status, delay = 0 }: StatusBadgeProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entry = spring({
    frame: frame - delay,
    fps,
    config: SPRING_CONFIGS.snappy,
  });
  const style = STATUS_STYLES[status];
  const isPulsing = status === "generating";
  const opacity = isPulsing ? 0.7 + pulse(frame, fps, 2) * 0.3 : 1;
  const glow = status === "live" ? `0 0 12px ${style.bg}80` : "none";

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 16px",
        borderRadius: 20,
        backgroundColor: `${style.bg}25`,
        border: `1px solid ${style.bg}60`,
        color: style.bg,
        fontSize: 14,
        fontWeight: 600,
        fontFamily: "Inter, sans-serif",
        transform: `scale(${entry})`,
        opacity: entry,
        boxShadow: glow,
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          backgroundColor: style.bg,
          opacity,
        }}
      />
      {style.label}
    </div>
  );
}
