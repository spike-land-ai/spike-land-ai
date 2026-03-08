import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { typewriter } from "../../lib/animations";
import { COLORS, SPRING_CONFIGS } from "../../../core-logic/constants";

type ChatBubbleProps = {
  message: string;
  isAi?: boolean;
  delay?: number;
  showTyping?: boolean;
  typingSpeed?: number;
};

export function ChatBubble({
  message,
  isAi = false,
  delay = 0,
  showTyping = true,
  typingSpeed = 40,
}: ChatBubbleProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entryProgress = spring({
    frame: frame - delay,
    fps,
    config: SPRING_CONFIGS.smooth,
  });

  const opacity = interpolate(entryProgress, [0, 0.5], [0, 1], {
    extrapolateRight: "clamp",
  });

  const translateY = interpolate(entryProgress, [0, 1], [30, 0]);
  const scale = interpolate(entryProgress, [0, 1], [0.9, 1]);

  // Typewriter effect for the message
  const visibleText = showTyping
    ? typewriter(frame, fps, message, typingSpeed, delay + 15)
    : message;

  const isTyping = showTyping && visibleText.length < message.length;

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px) scale(${scale})`,
        display: "flex",
        flexDirection: isAi ? "row" : "row-reverse",
        alignItems: "flex-end",
        gap: 12,
        marginBottom: 20,
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          backgroundColor: isAi ? COLORS.cyan : COLORS.purple,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          fontWeight: 900,
          color: "white",
          boxShadow: `0 4px 12px ${isAi ? COLORS.cyan : COLORS.purple}40`,
          flexShrink: 0,
        }}
      >
        {isAi ? "A" : "U"}
      </div>

      <div
        style={{
          maxWidth: "75%",
          padding: "18px 24px",
          borderRadius: isAi ? "4px 20px 20px 20px" : "20px 4px 20px 20px",
          backgroundColor: isAi ? `${COLORS.darkCard}EE` : COLORS.purple,
          border: `1px solid ${isAi ? COLORS.darkBorder : "rgba(255,255,255,0.1)"}`,
          boxShadow: isAi ? "0 8px 32px rgba(0,0,0,0.4)" : `0 8px 32px ${COLORS.purple}40`,
          backdropFilter: "blur(8px)",
        }}
      >
        {isAi && (
          <div
            style={{
              fontSize: 11,
              color: COLORS.cyan,
              marginBottom: 8,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: 1,
              fontFamily: "Inter, sans-serif",
            }}
          >
            Spike Assistant
          </div>
        )}
        <div
          style={{
            fontSize: 18,
            color: COLORS.textPrimary,
            lineHeight: 1.6,
            fontWeight: 500,
            fontFamily: "Inter, sans-serif",
          }}
        >
          {visibleText}
          {isTyping && (
            <span
              style={{
                display: "inline-block",
                width: 3,
                height: 20,
                backgroundColor: COLORS.cyan,
                marginLeft: 4,
                verticalAlign: "middle",
                opacity: Math.sin(frame * 0.4) > 0 ? 1 : 0,
                boxShadow: `0 0 8px ${COLORS.cyan}`,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export function TypingIndicator({ delay = 0 }: { delay?: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entryProgress = spring({
    frame: frame - delay,
    fps,
    config: SPRING_CONFIGS.smooth,
  });

  const opacity = interpolate(entryProgress, [0, 1], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        opacity,
        display: "flex",
        justifyContent: "flex-start",
        marginBottom: 12,
        paddingLeft: 44, // Align with bubble text
      }}
    >
      <div
        style={{
          padding: "12px 20px",
          borderRadius: "4px 16px 16px 16px",
          backgroundColor: COLORS.darkCard,
          border: `1px solid ${COLORS.darkBorder}`,
          display: "flex",
          gap: 6,
          alignItems: "center",
          boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
        }}
      >
        {[0, 1, 2].map((i) => {
          const dotProgress = Math.sin(frame * 0.15 - i * 0.5);
          const dotOpacity = interpolate(dotProgress, [-1, 1], [0.3, 1]);
          const dotY = interpolate(dotProgress, [-1, 1], [2, -2]);

          return (
            <div
              key={i}
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                backgroundColor: COLORS.cyan,
                opacity: dotOpacity,
                transform: `translateY(${dotY}px)`,
                boxShadow: `0 0 4px ${COLORS.cyan}40`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
