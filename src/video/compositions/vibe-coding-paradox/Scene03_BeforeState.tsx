import { type FC } from "react";
import {
  AbsoluteFill,
  interpolate,
  Sequence,
  useCurrentFrame,
  // useVideoConfig,
} from "remotion";
import { COLORS, TYPOGRAPHY } from "../../lib/constants";
import { SingleShotDiagram } from "../../components/diagrams/SingleShotDiagram";
import { CodeBlock } from "../../components/ui/CodeBlock";
import { ExamMetaphor } from "../../components/ui/ExamMetaphor";
import { ComparisonTable } from "../../components/diagrams/ComparisonTable";

const OLD_CODE = `const result = await geminiModel.generateContent(prompt);
if (!result) {
  const retry = await geminiModel.generateContent(prompt);
  return retry;
}
return result;`;

export const Scene03_BeforeState: FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.darkBg,
        fontFamily: TYPOGRAPHY.fontFamily.sans,
      }}
    >
      {/* Part 1: Single shot diagram */}
      <Sequence from={0} durationInFrames={180}>
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
              color: COLORS.textSecondary,
              opacity: interpolate(frame, [0, 6], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            The Single-Shot Problem
          </div>
          <SingleShotDiagram delay={3} attemptCount={10} />
        </AbsoluteFill>
      </Sequence>

      {/* Part 2: Old code with naive retry */}
      <Sequence from={180} durationInFrames={144}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 30,
            padding: 80,
          }}
        >
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: COLORS.error,
              opacity: interpolate(frame - 180, [0, 6], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            Naive Retry — No Memory
          </div>
          <div style={{ width: 800 }}>
            <CodeBlock
              code={OLD_CODE}
              language="typescript"
              delay={196}
              typingSpeed={90}
              borderColor={COLORS.error}
            />
          </div>
          <div
            style={{
              fontSize: 18,
              color: COLORS.textMuted,
              textAlign: "center",
              maxWidth: 600,
              lineHeight: 1.5,
              opacity: interpolate(frame - 180, [48, 57], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            Same prompt, same model, same mistakes. The retry has no idea what went wrong the first
            time.
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Part 3: Exam metaphor with memory wipe */}
      <Sequence from={324} durationInFrames={100}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 40,
          }}
        >
          <div
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: COLORS.textPrimary,
              opacity: interpolate(frame - 324, [0, 6], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            Like retaking an exam with your memory wiped
          </div>
          <ExamMetaphor delay={340} showMemoryWipe />
        </AbsoluteFill>
      </Sequence>

      {/* Part 4: Comparison table */}
      <Sequence from={424} durationInFrames={150}>
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ComparisonTable delay={435} />
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
