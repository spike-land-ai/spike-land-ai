import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { RecursiveZoomCore } from "../core/RecursiveZoomCore";

type RecursiveZoomProps = {
  depth?: number;
  delay?: number;
  zoomSpeed?: number; // legacy
};

export function RecursiveZoom({ depth = 3, delay = 0 }: RecursiveZoomProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const elapsed = Math.max(0, frame - delay);
  // Unused progress was previously calculated but not fully implemented here
  // Assuming progress calculation logic is needed or placeholder
  const progress = elapsed / (fps * 30);

  return (
    <AbsoluteFill>
      <RecursiveZoomCore depth={depth} progress={progress} />
    </AbsoluteFill>
  );
}
