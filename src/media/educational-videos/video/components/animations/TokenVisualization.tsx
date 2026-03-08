import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, SPRING_CONFIGS, VERITASIUM_COLORS } from "../../../core-logic/constants";
import { springScale, stagger } from "../../lib/animations";

type TokenVisualizationProps = {
  text: string;
  delay?: number;
  tokensPerWord?: number;
};

const TOKEN_PALETTE = [
  VERITASIUM_COLORS.planning,
  VERITASIUM_COLORS.generating,
  VERITASIUM_COLORS.transpiling,
  VERITASIUM_COLORS.fixing,
  VERITASIUM_COLORS.learning,
  COLORS.cyan,
  COLORS.fuchsia,
  COLORS.amber,
  COLORS.purple,
];

function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function TokenVisualization({
  text,
  delay = 0,
  tokensPerWord = 2,
}: TokenVisualizationProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const words = text.split(" ").filter((w) => w.length > 0);

  // Phase 1: Words appear (frames delay to delay+wordCount*stagger+30)
  // Phase 2: Words split into tokens (starts ~30 frames after all words visible)
  const allWordsVisibleAt = delay + words.length * 5 + 20;
  const splitPhaseProgress = interpolate(
    frame,
    [allWordsVisibleAt, allWordsVisibleAt + 30],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  let globalTokenIndex = 0;

  return (
    <AbsoluteFill
      style={{
        background: COLORS.darkBg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: splitPhaseProgress > 0 ? 12 : 20,
          justifyContent: "center",
          alignItems: "center",
          padding: 60,
          maxWidth: 1400,
        }}
      >
        {words.map((word, wordIndex) => {
          const wordDelay = delay + stagger(wordIndex, 5);
          const wordScale = springScale(frame, fps, SPRING_CONFIGS.snappy, wordDelay);

          // Generate tokens for this word
          const tokenCount = Math.max(1, Math.min(tokensPerWord, Math.ceil(word.length / 3)));
          const tokenChars: string[] = [];
          const charsPerToken = Math.ceil(word.length / tokenCount);
          for (let t = 0; t < tokenCount; t++) {
            tokenChars.push(word.slice(t * charsPerToken, (t + 1) * charsPerToken));
          }

          globalTokenIndex += tokenCount;

          // When not splitting, show as single word block
          if (splitPhaseProgress <= 0) {
            return (
              <div
                key={`word-${wordIndex}`}
                style={{
                  transform: `scale(${wordScale})`,
                  opacity: wordScale,
                  padding: "10px 20px",
                  backgroundColor: COLORS.darkCard,
                  border: `1px solid ${COLORS.darkBorder}`,
                  borderRadius: 8,
                  color: COLORS.textPrimary,
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: 24,
                  whiteSpace: "nowrap",
                }}
              >
                {word}
              </div>
            );
          }

          // Splitting phase: show individual token blocks
          return (
            <div
              key={`word-${wordIndex}`}
              style={{
                display: "flex",
                gap: interpolate(splitPhaseProgress, [0, 1], [0, 6]),
                opacity: wordScale,
              }}
            >
              {tokenChars.map((tokenStr, ti) => {
                const color = TOKEN_PALETTE[hashString(tokenStr) % TOKEN_PALETTE.length];

                const splitSpring = spring({
                  frame: frame - allWordsVisibleAt - ti * 2,
                  fps,
                  config: SPRING_CONFIGS.snappy,
                });

                const bgColor = interpolate(splitSpring, [0, 1], [0, 1]);

                return (
                  <div
                    key={`token-${wordIndex}-${ti}`}
                    style={{
                      padding: "8px 12px",
                      backgroundColor: bgColor > 0.5 ? `${color}25` : COLORS.darkCard,
                      border: `2px solid ${bgColor > 0.5 ? color : COLORS.darkBorder}`,
                      borderRadius: 6,
                      color: bgColor > 0.5 ? color : COLORS.textPrimary,
                      fontFamily: "JetBrains Mono, monospace",
                      fontSize: 22,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      transform: `scale(${interpolate(splitSpring, [0, 1], [0.9, 1])})`,
                      boxShadow: bgColor > 0.5 ? `0 0 10px ${color}30` : "none",
                    }}
                  >
                    {tokenStr}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Token count label */}
      {splitPhaseProgress > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: 80,
            width: "100%",
            textAlign: "center",
            color: COLORS.textSecondary,
            fontSize: 18,
            fontFamily: "JetBrains Mono, monospace",
            opacity: splitPhaseProgress,
          }}
        >
          {globalTokenIndex} tokens from {words.length} words
        </div>
      )}
    </AbsoluteFill>
  );
}
