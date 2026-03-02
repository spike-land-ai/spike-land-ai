import { type FC } from "react";
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";
import { COLORS, TYPOGRAPHY } from "../../lib/constants";
import { stagger } from "../../lib/animations";
import { KineticText } from "../../components/ui/KineticText";
import { GlassmorphismCard } from "../../components/ui/GlassmorphismCard";
import { HourglassTestModel } from "../../components/diagrams/HourglassTestModel";

const PRINCIPLES = [
  { num: 1, title: "Requirements are the product", color: COLORS.cyan },
  { num: 2, title: "Discipline before automation", color: COLORS.purple },
  { num: 3, title: "Context is architecture", color: COLORS.amber },
  { num: 4, title: "Test the lies", color: COLORS.error },
  { num: 5, title: "Orchestrate, don't operate", color: COLORS.success },
  { num: 6, title: "Trust is earned in PRs", color: COLORS.cyan },
  { num: 7, title: "Own what you ship", color: COLORS.purple },
];

export const Scene07_BAZDMEG: FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.darkBg,
        fontFamily: TYPOGRAPHY.fontFamily.sans,
      }}
    >
      {/* Part 1: Title + 7 principle cards (0-450) */}
      <Sequence from={0} durationInFrames={450}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "40px 60px",
            gap: 24,
          }}
        >
          <KineticText
            text="The BAZDMEG Method"
            fontSize={64}
            color={COLORS.textPrimary}
            type="reveal"
            delay={10}
          />

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              width: "100%",
              maxWidth: 900,
              marginTop: 20,
            }}
          >
            {PRINCIPLES.map((p, i) => (
              <GlassmorphismCard
                key={p.num}
                width={900}
                height={76}
                delay={30 + stagger(i, 20)}
                color={p.color}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    padding: "0 24px",
                    height: "100%",
                  }}
                >
                  <span
                    style={{
                      fontSize: TYPOGRAPHY.fontSize["2xl"],
                      fontWeight: 800,
                      color: p.color,
                      fontFamily: TYPOGRAPHY.fontFamily.mono,
                      minWidth: 36,
                    }}
                  >
                    {p.num}
                  </span>
                  <span
                    style={{
                      fontSize: TYPOGRAPHY.fontSize.xl,
                      fontWeight: 600,
                      color: COLORS.textPrimary,
                    }}
                  >
                    {p.title}
                  </span>
                </div>
              </GlassmorphismCard>
            ))}
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Part 2: Test the Lies - Hourglass Model (450-900) */}
      <Sequence from={450} durationInFrames={450}>
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
              fontSize: TYPOGRAPHY.fontSize["4xl"],
              fontWeight: 700,
              color: COLORS.textPrimary,
              textAlign: "center",
              opacity: interpolate(frame, [460, 480], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            Test the Lies
          </div>
          <div
            style={{
              fontSize: TYPOGRAPHY.fontSize.xl,
              color: COLORS.textSecondary,
              textAlign: "center",
              opacity: interpolate(frame, [470, 490], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            The Hourglass Model
          </div>
          <HourglassTestModel delay={470} />
        </AbsoluteFill>
      </Sequence>

      {/* Part 3: Closing principles (900-1350) */}
      <Sequence from={900} durationInFrames={450}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 40,
          }}
        >
          <KineticText
            text="Orchestrate, don't operate"
            fontSize={64}
            color={COLORS.textPrimary}
            type="scale"
            delay={920}
          />
          <KineticText
            text="Own what you ship"
            fontSize={56}
            color={COLORS.cyan}
            type="reveal"
            delay={980}
          />
          <div
            style={{
              fontSize: TYPOGRAPHY.fontSize["2xl"],
              color: COLORS.textMuted,
              textAlign: "center",
              maxWidth: 800,
              lineHeight: 1.5,
              opacity: interpolate(frame, [1050, 1090], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            If you can't explain it at 3 AM, don't deploy it
          </div>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
