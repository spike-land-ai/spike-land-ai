import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { DarwinianTreeCore } from "../../components/core/DarwinianTreeCore";
import { SPRING_CONFIGS } from "../../lib/constants";

export function Scene04_Darwin() {
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
      <DarwinianTreeCore progress={progress} className="w-full h-full" />
    </AbsoluteFill>
  );
}
