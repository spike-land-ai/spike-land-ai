import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { glitchOffset } from "../../lib/animations";
import { COLORS, SPRING_CONFIGS } from "../../lib/constants";

type FourOhFourSkullProps = {
  delay?: number;
};

export function FourOhFourSkull({ delay = 0 }: FourOhFourSkullProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const adjustedFrame = frame - delay;

  // Phase 1: Show 404 with glitch (frames 0-45)
  const errorOpacity = interpolate(adjustedFrame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const errorFadeOut = interpolate(adjustedFrame, [35, 50], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Phase 2: Green success icon appears (frames 40+)
  const iconProgress = spring({
    frame: adjustedFrame - 40,
    fps,
    config: SPRING_CONFIGS.bouncy,
  });

  const iconGlow = interpolate(Math.sin(adjustedFrame * 0.1), [-1, 1], [0.4, 0.8]);

  // Glitch effect for the 404 text
  const redOffset = glitchOffset(adjustedFrame, 8, 0);
  const blueOffset = glitchOffset(adjustedFrame, 8, 50);
  const isGlitchPhase = adjustedFrame > 5 && adjustedFrame < 45;

  return (
    <div
      style={{
        position: "relative",
        width: 400,
        height: 300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* 404 Error Text */}
      {errorFadeOut > 0 && (
        <div
          style={{
            position: "absolute",
            opacity: errorOpacity * errorFadeOut,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div style={{ position: "relative" }}>
            {isGlitchPhase && (
              <>
                <div
                  style={{
                    position: "absolute",
                    fontSize: 120,
                    fontWeight: 900,
                    color: "#ff0000",
                    mixBlendMode: "screen",
                    transform: `translate(${redOffset}px, ${redOffset * 0.3}px)`,
                    opacity: 0.7,
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  404
                </div>
                <div
                  style={{
                    position: "absolute",
                    fontSize: 120,
                    fontWeight: 900,
                    color: "#0000ff",
                    mixBlendMode: "screen",
                    transform: `translate(${blueOffset}px, ${blueOffset * -0.3}px)`,
                    opacity: 0.7,
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  404
                </div>
              </>
            )}
            <div
              style={{
                position: "relative",
                fontSize: 120,
                fontWeight: 900,
                color: isGlitchPhase ? COLORS.error : COLORS.error,
                fontFamily: "Inter, sans-serif",
                textShadow: `0 0 30px ${COLORS.error}80`,
              }}
            >
              404
            </div>
          </div>
          <div
            style={{
              fontSize: 20,
              color: COLORS.textSecondary,
              fontFamily: "Inter, sans-serif",
              marginTop: 8,
            }}
          >
            Page Not Found
          </div>
        </div>
      )}

      {/* Green Success Icon */}
      <div
        style={{
          position: "absolute",
          transform: `scale(${iconProgress})`,
          opacity: iconProgress,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* Circular glow background */}
        <div
          style={{
            width: 140,
            height: 140,
            borderRadius: 70,
            background: `${COLORS.success}15`,
            border: `3px solid ${COLORS.success}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 0 ${40 + iconGlow * 30}px ${COLORS.success}${Math.round(iconGlow * 60)
              .toString(16)
              .padStart(2, "0")}`,
          }}
        >
          {/* Play/checkmark icon via SVG */}
          <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
            <path
              d="M15 30L26 41L45 19"
              stroke={COLORS.success}
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: COLORS.success,
            fontFamily: "Inter, sans-serif",
            marginTop: 16,
            textShadow: `0 0 20px ${COLORS.success}60`,
          }}
        >
          Live App
        </div>
      </div>
    </div>
  );
}
