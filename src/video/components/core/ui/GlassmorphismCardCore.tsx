import { type CSSProperties, type FC, type ReactNode } from "react";
import { COLORS } from "../../../lib/constants";

export type GlassmorphismCardCoreProps = {
  children: ReactNode;
  width?: number | string;
  height?: number | string;
  progress?: number;
  color?: string;
  padding?: number | string;
  className?: string;
  style?: CSSProperties;
};

export const GlassmorphismCardCore: FC<GlassmorphismCardCoreProps> = ({
  children,
  width = 400,
  height = "auto",
  progress = 1,
  color = COLORS.cyan,
  padding = 32,
  className,
  style,
}) => {
  const opacity = progress;
  const y = (1 - progress) * 20;

  return (
    <div
      className={className}
      style={{
        ...style,
        width,
        height,
        opacity,
        transform: `translateY(${y}px)`,
        background: "rgba(255, 255, 255, 0.05)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderRadius: 24,
        border: `1px solid ${color}40`,
        padding,
        boxShadow: `0 8px 32px 0 rgba(0, 0, 0, 0.37), inset 0 0 0 1px rgba(255, 255, 255, 0.05)`,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Subtle background glow */}
      <div
        style={{
          position: "absolute",
          top: -100,
          right: -100,
          width: 200,
          height: 200,
          background: `${color}15`,
          filter: "blur(60px)",
          borderRadius: "50%",
        }}
      />
      {children}
    </div>
  );
};
