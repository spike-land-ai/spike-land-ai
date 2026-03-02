import { type FC } from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { COLORS, TYPOGRAPHY } from "../../lib/constants";
import { PetriDishAnimation } from "../../components/animations/PetriDishAnimation";
import { LearningNoteCard } from "../../components/diagrams/LearningNoteCard";
import { SoftmaxEquation } from "../../components/ui/SoftmaxEquation";
import { NoteLifecycle } from "../../components/diagrams/NoteLifecycle";
import { TokenBudgetMeter } from "../../components/ui/TokenBudgetMeter";

const ORGANISMS = [
  { label: "Import fix", status: "active" as const, confidence: 0.85 },
  { label: "ESM pattern", status: "active" as const, confidence: 0.7 },
  { label: "Wrong approach", status: "deprecated" as const, confidence: 0.2 },
  { label: "New pattern", status: "candidate" as const, confidence: 0.5 },
];

const BUDGET_NOTES = [
  { label: "Import fix", tokens: 180, confidence: 0.85 },
  { label: "ESM pattern", tokens: 150, confidence: 0.7 },
  { label: "New pattern", tokens: 120, confidence: 0.5 },
  { label: "Wrong approach", tokens: 60, confidence: 0.2 },
];

export const Scene06_AgentMemory: FC = () => {
  const frame = useCurrentFrame();

  // Cycle activeStage for NoteLifecycle (0->1->2 over the segment)
  const lifecycleFrame = frame - 578;
  const cycleLength = 83;
  const activeStage = Math.min(2, Math.floor(Math.max(0, lifecycleFrame) / cycleLength));

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.darkBg,
        fontFamily: TYPOGRAPHY.fontFamily.sans,
      }}
    >
      {/* Part 1: Petri dish — learning notes ecosystem (0-330) */}
      <Sequence from={0} durationInFrames={330}>
        <PetriDishAnimation organisms={ORGANISMS} delay={6} />
      </Sequence>

      {/* Part 2: Learning note card zoom-in (330-578) */}
      <Sequence from={330} durationInFrames={248}>
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <LearningNoteCard
            pattern="Cannot find module 'confetti'"
            solution="Use canvas-confetti with CDN import"
            confidence={0.5}
            status="CANDIDATE"
            timesApplied={0}
            delay={6}
          />
        </AbsoluteFill>
      </Sequence>

      {/* Part 3: Laplace smoothing equation (578-826) */}
      <Sequence from={578} durationInFrames={248}>
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <SoftmaxEquation variant="laplace" delay={6} />
        </AbsoluteFill>
      </Sequence>

      {/* Part 4: Note lifecycle — candidate -> active -> deprecated (826-1032) */}
      <Sequence from={826} durationInFrames={206}>
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <NoteLifecycle revealCount={3} activeStage={activeStage} delay={6} />
        </AbsoluteFill>
      </Sequence>

      {/* Part 5: Token budget meter (1032-1238) */}
      <Sequence from={1032} durationInFrames={206}>
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <TokenBudgetMeter notes={BUDGET_NOTES} delay={6} />
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
