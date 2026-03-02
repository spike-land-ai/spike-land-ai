import { type FC } from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { SPRING_CONFIGS } from "../../lib/constants";

type LivePreviewMockupProps = {
  delay?: number;
};

const TODOS = [
  { text: "Design UI", done: true },
  { text: "Add dark mode", done: false },
  { text: "Deploy to edge", done: false },
];

export const LivePreviewMockup: FC<LivePreviewMockupProps> = ({ delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entry = spring({
    frame: frame - delay,
    fps,
    config: SPRING_CONFIGS.snappy,
  });

  return (
    <div
      style={{
        opacity: entry,
        transform: `scale(${0.9 + entry * 0.1})`,
        backgroundColor: "#1a1a2e",
        borderRadius: 12,
        padding: 24,
        width: "100%",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: "#fff",
          marginBottom: 16,
        }}
      >
        Todo App
      </div>
      {TODOS.map((todo, i) => {
        const itemEntry = spring({
          frame: frame - delay - i * 8,
          fps,
          config: SPRING_CONFIGS.snappy,
        });
        return (
          <div
            key={i}
            style={{
              opacity: itemEntry,
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 0",
              borderBottom: "1px solid #2a2a3e",
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: 4,
                border: `2px solid ${todo.done ? "#22c55e" : "#6b7280"}`,
                backgroundColor: todo.done ? "#22c55e" : "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                color: "#fff",
              }}
            >
              {todo.done ? "\u2713" : ""}
            </div>
            <span
              style={{
                fontSize: 15,
                color: todo.done ? "#6b7280" : "#fff",
                textDecoration: todo.done ? "line-through" : "none",
              }}
            >
              {todo.text}
            </span>
          </div>
        );
      })}
      <div
        style={{
          marginTop: 16,
          padding: "10px 14px",
          borderRadius: 8,
          border: "1px solid #2a2a3e",
          backgroundColor: "#0a0a0f",
          color: "#6b7280",
          fontSize: 14,
        }}
      >
        Add a new todo...
      </div>
    </div>
  );
};
