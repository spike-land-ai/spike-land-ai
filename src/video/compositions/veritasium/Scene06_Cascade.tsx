import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { ModelCascadeCore } from "../../components/core/ModelCascadeCore";
import { SPRING_CONFIGS } from "../../lib/constants";

export function Scene06_Cascade() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame,
    fps,
    config: SPRING_CONFIGS.gentle,
    durationInFrames: 90,
  });

  return (
    <AbsoluteFill className="bg-black">
      <ModelCascadeCore
        progress={progress}
        hoveredTier={null}
        className="w-full h-full"
        style={{ transform: "scale(0.9)" }}
      />
    </AbsoluteFill>
  );
}
