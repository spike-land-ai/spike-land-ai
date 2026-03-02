import { type ReactNode } from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { SPRING_CONFIGS } from "../../lib/constants";
import { SplitScreenCore } from "../core/SplitScreenCore";

type SplitScreenRevealProps = {
  leftContent: ReactNode;
  rightContent: ReactNode;
  /** Animated split point 0-1 (default animates automatically) */
  splitPoint?: number;
  revealDirection?: "left-to-right" | "right-to-left";
  delay?: number;
};

export function SplitScreenReveal({
  leftContent,
  rightContent,
  splitPoint,
  revealDirection = "left-to-right",
  delay = 0,
}: SplitScreenRevealProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const animatedSplit =
    splitPoint ??
    spring({
      frame: frame - delay,
      fps,
      config: SPRING_CONFIGS.smooth,
      durationInFrames: 45,
    });

  return (
    <AbsoluteFill>
      <SplitScreenCore
        leftContent={leftContent}
        rightContent={rightContent}
        progress={animatedSplit}
        revealDirection={revealDirection}
      />
    </AbsoluteFill>
  );
}
