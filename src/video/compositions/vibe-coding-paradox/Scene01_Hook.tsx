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
import { typewriter } from "../../lib/animations";
import { BrowserFrame } from "../../components/mockups/BrowserFrame";
import { SplitScreenReveal } from "../../components/animations/SplitScreenReveal";
import { CodeBlock } from "../../components/ui/CodeBlock";
import { KineticText } from "../../components/ui/KineticText";
import { GradientMesh } from "../../components/branding/GradientMesh";

export const Scene01_Hook: FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const url = "spike.land/create/games/tetris";
  const visibleUrl = typewriter(frame, fps, url, 20, 15);

  // Subtle continuous camera zoom for visual momentum
  const sceneZoom = interpolate(frame, [0, 1514], [1.0, 1.02], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.darkBg,
        fontFamily: TYPOGRAPHY.fontFamily.sans,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          transform: `scale(${sceneZoom})`,
        }}
      >
        {/* Part 1: Browser frame with typing URL and green Tetris success */}
        <Sequence from={0} durationInFrames={252}>
          <AbsoluteFill
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 80,
            }}
          >
            <BrowserFrame url={visibleUrl} width={1400} height={750}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  background: `linear-gradient(135deg, ${COLORS.darkBg}, #0f1a0f)`,
                }}
              >
                <div
                  style={{
                    fontSize: 96,
                    fontWeight: 800,
                    color: COLORS.success,
                    fontFamily: TYPOGRAPHY.fontFamily.mono,
                    textShadow: `0 0 40px ${COLORS.success}60, 0 0 80px ${COLORS.success}30`,
                    opacity: interpolate(frame, [50, 76], [0, 1], {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    }),
                    transform: `scale(${interpolate(frame, [50, 76], [0.8, 1], {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    })})`,
                  }}
                >
                  TETRIS
                </div>
              </div>
            </BrowserFrame>
          </AbsoluteFill>
        </Sequence>

        {/* Part 2: Split screen - success left, error right */}
        <Sequence from={252} durationInFrames={252}>
          <SplitScreenReveal
            leftContent={
              <AbsoluteFill
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: `linear-gradient(135deg, ${COLORS.darkBg}, #0f1a0f)`,
                }}
              >
                <div
                  style={{
                    fontSize: 72,
                    fontWeight: 800,
                    color: COLORS.success,
                    fontFamily: TYPOGRAPHY.fontFamily.mono,
                    textShadow: `0 0 30px ${COLORS.success}50`,
                  }}
                >
                  TETRIS
                </div>
              </AbsoluteFill>
            }
            rightContent={
              <AbsoluteFill
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: `linear-gradient(135deg, ${COLORS.darkBg}, #1a0f0f)`,
                  padding: 60,
                }}
              >
                <div style={{ width: 700 }}>
                  <CodeBlock
                    code={`Error: Cannot read properties of undefined
  at TetrisBoard.render (game.tsx:142)
  at processChild (react-dom.js:1234)

TypeError: board.map is not a function
  at renderGrid (game.tsx:67)`}
                    language="error"
                    borderColor={COLORS.error}
                    delay={17}
                    typingSpeed={40}
                  />
                </div>
              </AbsoluteFill>
            }
            delay={8}
          />
        </Sequence>

        {/* Part 3: Error cascade - multiple CodeBlocks stacking */}
        <Sequence from={504} durationInFrames={252}>
          <AbsoluteFill
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 20,
              padding: 60,
            }}
          >
            {[
              { code: 'ReferenceError: "board" is not defined', d: 0 },
              { code: "SyntaxError: Unexpected token '}'", d: 25 },
              { code: "TypeError: Cannot call undefined as function", d: 50 },
              { code: "RangeError: Maximum call stack size exceeded", d: 76 },
            ].map((err, i) => {
              const localFrame = frame - 504;
              const errOpacity = interpolate(localFrame, [err.d, err.d + 13], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              const errSlide = interpolate(localFrame, [err.d, err.d + 13], [30, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });

              return (
                <div
                  key={i}
                  style={{
                    opacity: errOpacity,
                    transform: `translateY(${errSlide}px)`,
                    width: 900,
                  }}
                >
                  <CodeBlock
                    code={err.code}
                    language="error"
                    borderColor={COLORS.error}
                    delay={504 + err.d}
                    typingSpeed={80}
                  />
                </div>
              );
            })}
          </AbsoluteFill>
        </Sequence>

        {/* Part 4: ZERO MEMORY huge text */}
        <Sequence from={756} durationInFrames={252}>
          <AbsoluteFill
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <KineticText
              text="ZERO MEMORY"
              fontSize={140}
              color={COLORS.textPrimary}
              type="scale"
              delay={765}
            />
          </AbsoluteFill>
        </Sequence>

        {/* Part 5: Title card with gradient mesh */}
        <Sequence from={1008} durationInFrames={506}>
          <AbsoluteFill>
            <GradientMesh
              animationSpeed={0.015}
              opacity={interpolate(frame, [1008, 1058], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })}
            />
            <AbsoluteFill
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 30,
              }}
            >
              <KineticText
                text="THE VIBE CODING"
                fontSize={90}
                color={COLORS.textPrimary}
                type="reveal"
                delay={1043}
              />
              <KineticText
                text="PARADOX"
                fontSize={120}
                color={COLORS.cyan}
                type="scale"
                delay={1110}
              />
              <div
                style={{
                  marginTop: 30,
                  fontSize: 24,
                  color: COLORS.textSecondary,
                  fontFamily: TYPOGRAPHY.fontFamily.sans,
                  opacity: spring({
                    frame: frame - 1177,
                    fps,
                    config: SPRING_CONFIGS.smooth,
                  }),
                }}
              >
                Why AI-generated code fails — and how physics fixes it
              </div>
            </AbsoluteFill>
          </AbsoluteFill>
        </Sequence>
      </div>
    </AbsoluteFill>
  );
};
