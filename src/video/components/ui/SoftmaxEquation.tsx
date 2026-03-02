import { type FC } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, SPRING_CONFIGS, TYPOGRAPHY } from "../../lib/constants";
import { stagger } from "../../lib/animations";

type SoftmaxEquationProps = {
  variant?: "softmax" | "laplace";
  delay?: number;
};

const SOFTMAX_TERMS = [
  "Attention",
  " = ",
  "softmax(",
  "QK",
  "T",
  " / ",
  "\u221Ad",
  ")",
  " \u00D7 ",
  "V",
] as const;

const LAPLACE_TERMS = ["(", "s + 1", ")", " / ", "(", "s + f + 2", ")"] as const;

// Superscript "T" in softmax variant
const isSuperscript = (variant: "softmax" | "laplace", index: number) =>
  variant === "softmax" && index === 4;

// Terms that are math operators/delimiters (don't highlight)
const isOperator = (term: string) => [" = ", " / ", " \u00D7 ", "(", ")"].includes(term);

export const SoftmaxEquation: FC<SoftmaxEquationProps> = ({ variant = "softmax", delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const terms = variant === "softmax" ? SOFTMAX_TERMS : LAPLACE_TERMS;
  const staggerFrames = 6;
  const highlightDuration = 20; // frames each term stays highlighted

  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "center",
        gap: 0,
        fontFamily: TYPOGRAPHY.fontFamily.mono,
        fontSize: variant === "softmax" ? TYPOGRAPHY.fontSize["5xl"] : TYPOGRAPHY.fontSize["6xl"],
        fontWeight: 600,
      }}
    >
      {terms.map((term, index) => {
        const itemDelay = delay + stagger(index, staggerFrames);

        // Fade in
        const fadeProgress = spring({
          frame: frame - itemDelay,
          fps,
          config: SPRING_CONFIGS.smooth,
        });
        const opacity = interpolate(fadeProgress, [0, 1], [0, 1]);

        // Highlight: each term gets a window where it glows
        const highlightStart = delay + stagger(index, staggerFrames);
        const highlightEnd = highlightStart + highlightDuration;
        const isHighlighted = !isOperator(term) && frame >= highlightStart && frame < highlightEnd;

        const color = isHighlighted ? COLORS.cyan : COLORS.textPrimary;
        const textShadow = isHighlighted
          ? `0 0 20px ${COLORS.cyan}80, 0 0 40px ${COLORS.cyan}40`
          : "none";

        return (
          <span
            key={index}
            style={{
              opacity,
              color,
              textShadow,
              transition: "color 0.15s, text-shadow 0.15s",
              display: "inline-block",
              ...(isSuperscript(variant, index)
                ? {
                    fontSize: TYPOGRAPHY.fontSize["3xl"],
                    verticalAlign: "super",
                    lineHeight: 1,
                  }
                : {}),
            }}
          >
            {term}
          </span>
        );
      })}
    </div>
  );
};
