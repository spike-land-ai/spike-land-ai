import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { typewriter } from "../../lib/animations";
import { COLORS, SPRING_CONFIGS } from "../../lib/constants";

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

  const translateY = interpolate(entryProgress, [0, 1], [20, 0]);
  const scale = interpolate(entryProgress, [0, 1], [0.95, 1]);

  // Typewriter effect for the message
  const visibleText = showTyping
    ? typewriter(frame, fps, message, typingSpeed, delay + 10)
    : message;

  const isTyping = showTyping && visibleText.length < message.length;

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px) scale(${scale})`,
        display: "flex",
        justifyContent: isAi ? "flex-start" : "flex-end",
        marginBottom: 12,
      }}
    >
      <div
        style={{
          maxWidth: "70%",
          padding: "16px 20px",
          borderRadius: isAi ? "4px 16px 16px 16px" : "16px 4px 16px 16px",
          backgroundColor: isAi ? COLORS.darkCard : COLORS.purple,
          border: `1px solid ${isAi ? COLORS.darkBorder : "transparent"}`,
          boxShadow: isAi ? "0 4px 12px rgba(0,0,0,0.3)" : `0 4px 20px ${COLORS.purple}40`,
        }}
      >
        {isAi && (
          <div
            style={{
              fontSize: 12,
              color: COLORS.cyan,
              marginBottom: 6,
              fontWeight: 600,
              fontFamily: "Inter, sans-serif",
            }}
          >
            AI Agent
          </div>
        )}
        <div
          style={{
            fontSize: 16,
            color: COLORS.textPrimary,
            lineHeight: 1.5,
            fontFamily: "Inter, sans-serif",
          }}
        >
          {visibleText}
          {isTyping && (
            <span
              style={{
                opacity: Math.sin(frame * 0.3) > 0 ? 1 : 0,
                color: COLORS.cyan,
              }}
            >
              |
            </span>
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
      }}
    >
      <div
        style={{
          padding: "16px 24px",
          borderRadius: "4px 16px 16px 16px",
          backgroundColor: COLORS.darkCard,
          border: `1px solid ${COLORS.darkBorder}`,
          display: "flex",
          gap: 6,
          alignItems: "center",
        }}
      >
        {[0, 1, 2].map((i) => {
          const dotProgress = Math.sin((frame + i * 8) * 0.2);
          const dotOpacity = interpolate(dotProgress, [-1, 1], [0.3, 1]);
          const dotScale = interpolate(dotProgress, [-1, 1], [0.8, 1]);

          return (
            <div
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: COLORS.cyan,
                opacity: dotOpacity,
                transform: `scale(${dotScale})`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
