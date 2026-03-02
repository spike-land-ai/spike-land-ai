import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, SPRING_CONFIGS } from "../../lib/constants";

type KineticTextProps = {
  text: string;
  fontSize?: number;
  color?: string;
  delay?: number;
  type?: "slide" | "reveal" | "scale";
  direction?: "left" | "right" | "top" | "bottom";
};

export function KineticText({
  text,
  fontSize = 48,
  color = COLORS.textPrimary,
  delay = 0,
  type = "slide",
  direction = "bottom",
}: KineticTextProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - delay,
    fps,
    config: SPRING_CONFIGS.smooth,
  });

  const opacity = interpolate(progress, [0, 0.5], [0, 1]);

  let transform = "";
  if (type === "slide") {
    const offset = interpolate(progress, [0, 1], [50, 0]);
    const axis = direction === "left" || direction === "right" ? "X" : "Y";
    const multiplier = direction === "right" || direction === "bottom" ? 1 : -1;
    transform = `translate${axis}(${offset * multiplier}px)`;
  } else if (type === "scale") {
    const scale = interpolate(progress, [0, 1], [0.8, 1]);
    transform = `scale(${scale})`;
  }

  return (
    <div
      style={{
        fontSize,
        fontWeight: 700,
        color,
        fontFamily: "Inter, sans-serif",
        opacity,
        transform,
      }}
    >
      {type === "reveal" ? (
        <div style={{ display: "flex", gap: "0.1em" }}>
          {text.split("").map((char, i) => {
            const charProgress = spring({
              frame: frame - delay - i * 2,
              fps,
              config: SPRING_CONFIGS.smooth,
            });
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  opacity: interpolate(charProgress, [0, 0.5], [0, 1]),
                  transform: `translateY(${interpolate(charProgress, [0, 1], [20, 0])}px)`,
                }}
              >
                {char === " " ? "\u00A0" : char}
              </span>
            );
          })}
        </div>
      ) : (
        text
      )}
    </div>
  );
}
