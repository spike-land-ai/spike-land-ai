import { type FC, type ReactNode } from "react";
import { COLORS } from "../../lib/constants";

export type SplitScreenCoreProps = {
  leftContent: ReactNode;
  rightContent: ReactNode;
  progress: number; // 0-1 for reveal
  revealDirection?: "left-to-right" | "right-to-left";
  width?: number | string;
  height?: number | string;
  className?: string;
};

const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

export const SplitScreenCore: FC<SplitScreenCoreProps> = ({
  leftContent,
  rightContent,
  progress,
  revealDirection = "left-to-right",
  width = "100%",
  height = "100%",
  className,
}) => {
  const effectiveSplit = revealDirection === "right-to-left" ? 1 - progress : progress;
  const splitPercent = clamp(effectiveSplit, 0, 1) * 100;

  const glowOpacity = clamp(1 - Math.abs(progress - 0.5) * 2, 0.4, 1);

  return (
    <div
      className={className}
      style={{
        width,
        height,
        background: COLORS.darkBg, // keep dark bg
        position: "relative",
        overflow: "hidden",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* Background texture/grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `radial-gradient(${COLORS.cyan}10 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
          opacity: 0.3,
          pointerEvents: "none",
        }}
      />

      {/* Right side (Vibe Coding) - Base Layer */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          clipPath: `inset(0 0 0 ${splitPercent}%)`,
          filter: "contrast(1.2) sepia(0.5) hue-rotate(-50deg) saturate(1.5)", // Reddish/chaotic tint
        }}
      >
        {rightContent}
        {/* CRT Scanline overlay for vibe coding side */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))",
            backgroundSize: "100% 4px, 6px 100%",
            opacity: 0.4,
          }}
        />
      </div>

      {/* Left side (Context Engineered Agent) - Top Layer */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          clipPath: `inset(0 ${100 - splitPercent}% 0 0)`,
          background: "rgba(10, 15, 20, 0.6)",
          backdropFilter: "blur(4px)",
        }}
      >
        {leftContent}
      </div>

      {/* Laser Divider line */}
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: `${splitPercent}%`,
          width: 2,
          background: COLORS.cyan,
          boxShadow: `
            0 0 ${10 * glowOpacity}px ${COLORS.cyan}, 
            0 0 ${20 * glowOpacity}px ${COLORS.cyan}80,
            0 0 ${40 * glowOpacity}px ${COLORS.cyan}40,
            -10px 0 20px rgba(0,0,0,0.5)
          `,
          transform: "translateX(-50%)",
          zIndex: 10,
        }}
      >
        {/* Center Handle Knob styling */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 12,
            height: 48,
            borderRadius: 6,
            background: COLORS.darkBg,
            border: `2px solid ${COLORS.cyan}`,
            boxShadow: `0 0 10px ${COLORS.cyan}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
          }}
        >
          <div
            style={{
              width: 2,
              height: 16,
              background: COLORS.cyan,
              borderRadius: 2,
              opacity: 0.8,
            }}
          />
          <div
            style={{
              width: 2,
              height: 16,
              background: COLORS.cyan,
              borderRadius: 2,
              opacity: 0.8,
            }}
          />
        </div>
      </div>
    </div>
  );
};
