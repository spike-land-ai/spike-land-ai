import { type FC, type ReactNode } from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, SPRING_CONFIGS } from "../../lib/constants";
import { GlassmorphismCardCore } from "../core/ui/GlassmorphismCardCore";

type GlassmorphismCardProps = {
  children: ReactNode;
  width?: number | string;
  height?: number | string;
  delay?: number;
  color?: string;
  animate?: boolean;
};

export const GlassmorphismCard: FC<GlassmorphismCardProps> = ({
  children,
  width = 400,
  height = "auto",
  delay = 0,
  color = COLORS.cyan,
  animate = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = animate
    ? spring({
        frame: frame - delay,
        fps,
        config: SPRING_CONFIGS.snappy,
      })
    : 1;

  return (
    <GlassmorphismCardCore width={width} height={height} progress={progress} color={color}>
      {children}
    </GlassmorphismCardCore>
  );
};
