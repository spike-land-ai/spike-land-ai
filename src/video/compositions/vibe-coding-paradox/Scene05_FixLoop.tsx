import { type FC } from "react";
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";
import { COLORS, TYPOGRAPHY } from "../../lib/constants";
import { DarwinianTree } from "../../components/animations/DarwinianTree";
import { AgentLoopDiagram } from "../../components/diagrams/AgentLoopDiagram";
import { TemperatureGauge } from "../../components/diagrams/TemperatureGauge";
import { ModelCascadeTable } from "../../components/diagrams/ModelCascadeTable";

export const Scene05_FixLoop: FC = () => {
  const frame = useCurrentFrame();

  // Animate DarwinianTree generations (frames 0-412)
  const treeGenerations = Math.min(
    3,
    Math.floor(
      interpolate(frame, [33, 330], [1, 3.9], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    ),
  ) as 1 | 2 | 3;

  const loopLocalFrame = frame - 412;
  const stateIndex = loopLocalFrame > 17 ? Math.floor((loopLocalFrame - 17) / 33) % 5 : -1;
  const STATES = ["planning", "generating", "transpiling", "fixing", "learning"] as const;
  const activeState = stateIndex >= 0 ? STATES[stateIndex] : undefined;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.darkBg,
        fontFamily: TYPOGRAPHY.fontFamily.sans,
      }}
    >
      {/* Part 1: Darwinian tree - evolutionary pruning */}
      <Sequence from={0} durationInFrames={412}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 40,
              fontSize: 28,
              fontWeight: 700,
              color: COLORS.textPrimary,
              opacity: interpolate(frame, [0, 11], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              zIndex: 10,
            }}
          >
            Darwinian Code Selection
          </div>
          <DarwinianTree generations={treeGenerations} delay={11} />
        </AbsoluteFill>
      </Sequence>

      {/* Part 2: Agent loop diagram with cycling active state */}
      <Sequence from={412} durationInFrames={330}>
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <AgentLoopDiagram revealCount={7} activeState={activeState} showLoop scale={0.8} />
        </AbsoluteFill>
      </Sequence>

      {/* Part 3: Temperature gauge */}
      <Sequence from={742} durationInFrames={248}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 30,
          }}
        >
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: COLORS.textPrimary,
              opacity: interpolate(frame - 742, [0, 11], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            Temperature Tuning by Role
          </div>
          <TemperatureGauge delay={751} showLabels />
        </AbsoluteFill>
      </Sequence>

      {/* Part 4: Model cascade table */}
      <Sequence from={990} durationInFrames={247}>
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ModelCascadeTable delay={998} revealCount={3} />
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
