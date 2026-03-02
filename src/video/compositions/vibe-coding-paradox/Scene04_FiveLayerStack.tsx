import { type FC } from "react";
import {
  AbsoluteFill,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, SPRING_CONFIGS, TYPOGRAPHY } from "../../lib/constants";
import { countUp } from "../../lib/animations";
import { FiveLayerStack } from "../../components/diagrams/FiveLayerStack";
import { PhysicsMapping } from "../../components/diagrams/PhysicsMapping";
import { CodeBlock } from "../../components/ui/CodeBlock";
import { KineticText } from "../../components/ui/KineticText";

const SYSTEM_PROMPT_CODE = `function buildAgentSystemPrompt(req) {
  const stable = [identity, knowledge, examples];
  const dynamic = [constraints, tools(req)];
  return { cached: stable, fresh: dynamic };
}`;

export const Scene04_FiveLayerStack: FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Animate reveal count from 1 to 5 over 507 frames
  const revealCount = Math.min(5, Math.floor(frame / 101) + 1);

  // Cost multiplier countUp (frames 1183-1520)
  const costValue = countUp(frame, fps, 10, 2, 1210);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.darkBg,
        fontFamily: TYPOGRAPHY.fontFamily.sans,
      }}
    >
      {/* Part 1: Five layer stack revealing over time */}
      <Sequence from={0} durationInFrames={507}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
          }}
        >
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: COLORS.textPrimary,
              opacity: spring({
                frame,
                fps,
                config: SPRING_CONFIGS.smooth,
              }),
            }}
          >
            The Five-Layer System Prompt
          </div>
          <FiveLayerStack revealCount={revealCount} delay={8} />
        </AbsoluteFill>
      </Sequence>

      {/* Part 2: Physics mapping diagram */}
      <Sequence from={507} durationInFrames={338}>
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
              fontSize: 26,
              fontWeight: 700,
              color: COLORS.textSecondary,
              opacity: interpolate(frame - 507, [0, 11], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            Physics Maps to Code
          </div>
          <PhysicsMapping delay={515} revealCount={5} />
        </AbsoluteFill>
      </Sequence>

      {/* Part 3: Code block showing system prompt builder */}
      <Sequence from={845} durationInFrames={338}>
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
              color: COLORS.cyan,
              opacity: interpolate(frame - 845, [0, 11], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            Splitting Cached vs Fresh Layers
          </div>
          <div style={{ width: 850 }}>
            <CodeBlock
              code={SYSTEM_PROMPT_CODE}
              language="typescript"
              delay={856}
              typingSpeed={35}
              borderColor={COLORS.cyan}
            />
          </div>
          <div
            style={{
              fontSize: 18,
              color: COLORS.textMuted,
              textAlign: "center",
              maxWidth: 700,
              lineHeight: 1.5,
              opacity: interpolate(frame - 845, [113, 130], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            Stable layers go into the KV cache. Dynamic layers stay fresh.
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Part 4: Cost savings with countUp */}
      <Sequence from={1183} durationInFrames={337}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 16,
            }}
          >
            <KineticText
              text={`${costValue}×`}
              fontSize={160}
              color={COLORS.cyan}
              type="scale"
              delay={1194}
            />
          </div>
          <KineticText
            text="cheaper"
            fontSize={72}
            color={COLORS.textPrimary}
            type="slide"
            direction="bottom"
            delay={1239}
          />
          <div
            style={{
              fontSize: 22,
              color: COLORS.textSecondary,
              marginTop: 20,
              opacity: interpolate(frame - 1183, [101, 118], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            with KV cache prefix matching
          </div>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
