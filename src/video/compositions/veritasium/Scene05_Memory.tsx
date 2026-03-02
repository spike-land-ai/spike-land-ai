import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BayesianConfidenceCore } from "../../components/core/BayesianConfidenceCore";
import { SPRING_CONFIGS } from "../../lib/constants";

export function Scene05_Memory() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame,
    fps,
    config: SPRING_CONFIGS.slow,
    durationInFrames: 90,
  });

  return (
    <AbsoluteFill className="bg-[#05050a]">
      <BayesianConfidenceCore
        progress={progress}
        successes={3}
        failures={1}
        className="w-full h-full"
        style={{ transform: "scale(0.75)" }}
      />
    </AbsoluteFill>
  );
}
