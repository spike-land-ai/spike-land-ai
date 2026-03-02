import { type FC } from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, SPRING_CONFIGS, TYPOGRAPHY } from "../../lib/constants";
import { GlassmorphismCard } from "./GlassmorphismCard";

type PlatformCardProps = {
  icon: string;
  title: string;
  subtitle: string;
  color: string;
  delay: number;
};

export const PlatformCard: FC<PlatformCardProps> = ({ icon, title, subtitle, color, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - delay,
    fps,
    config: SPRING_CONFIGS.snappy,
  });

  return (
    <div
      style={{
        opacity: progress,
        transform: `translateY(${(1 - progress) * 40}px)`,
      }}
    >
      <GlassmorphismCard width={860} color={color} delay={delay}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            padding: "20px 28px",
          }}
        >
          <div
            style={{
              fontSize: 40,
              fontFamily: TYPOGRAPHY.fontFamily.mono,
              fontWeight: 700,
              color,
              minWidth: 60,
              textAlign: "center",
            }}
          >
            {icon}
          </div>
          <div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: COLORS.textPrimary,
              }}
            >
              {title}
            </div>
            <div style={{ fontSize: 18, color: COLORS.textMuted, marginTop: 4 }}>{subtitle}</div>
          </div>
        </div>
      </GlassmorphismCard>
    </div>
  );
};
