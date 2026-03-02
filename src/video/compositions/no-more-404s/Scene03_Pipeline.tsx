import { type FC } from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { COLORS, TYPOGRAPHY } from "../../lib/constants";
import { KineticText } from "../../components/ui/KineticText";
import { ChatBubble } from "../../components/ui/ChatBubble";
import { CodeBlock } from "../../components/ui/CodeBlock";
import { SplitScreenReveal } from "../../components/animations/SplitScreenReveal";
import { LivePreviewMockup } from "../../components/mockups/LivePreviewMockup";
import { StatusBadge } from "../../components/ui/StatusBadge";

const TODO_CODE = `function TodoApp() {
  const [todos, setTodos] = useState([]);
  const [dark, setDark] = useState(true);

  return (
    <div className={dark ? "dark" : ""}>
      <h1>My Todos</h1>
      {todos.map(t => <Todo key={t.id} />)}
    </div>
  );
}`;

export const Scene03_Codespace: FC = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.darkBg,
        fontFamily: TYPOGRAPHY.fontFamily.sans,
      }}
    >
      {/* Part 1: Title + Chat interaction (0-213) */}
      <Sequence from={0} durationInFrames={213}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 60,
            gap: 40,
          }}
        >
          <KineticText
            text="The Codespace"
            fontSize={72}
            color={COLORS.textPrimary}
            type="reveal"
            delay={0}
          />

          <div style={{ width: 800, marginTop: 30 }}>
            <ChatBubble message="Build me a todo app with dark mode" isAi={false} delay={16} />
            <ChatBubble
              message="I'll create a React todo app with dark mode support..."
              isAi={true}
              delay={43}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "flex-start",
                marginTop: 16,
              }}
            >
              <StatusBadge status="generating" delay={69} />
            </div>
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Part 2: Split screen — code on left, preview on right (213-426) */}
      <Sequence from={213} durationInFrames={213}>
        <SplitScreenReveal
          leftContent={
            <div
              style={{
                padding: 30,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
              }}
            >
              <div style={{ width: "90%" }}>
                <CodeBlock
                  code={TODO_CODE}
                  language="tsx"
                  borderColor={COLORS.cyan}
                  delay={225}
                  typingSpeed={50}
                />
              </div>
            </div>
          }
          rightContent={
            <div
              style={{
                padding: 30,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
              }}
            >
              <div style={{ width: "90%" }}>
                <LivePreviewMockup delay={240} />
              </div>
            </div>
          }
          delay={213}
        />
      </Sequence>

      {/* Part 3: IDE summary text (426-639) */}
      <Sequence from={426} durationInFrames={213}>
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
            text="Chat on the left"
            fontSize={56}
            color={COLORS.textPrimary}
            type="slide"
            direction="left"
            delay={440}
          />
          <KineticText
            text="Live app on the right"
            fontSize={56}
            color={COLORS.textPrimary}
            type="slide"
            direction="right"
            delay={460}
          />
          <div style={{ marginTop: 20 }}>
            <KineticText
              text="Full IDE in the browser"
              fontSize={72}
              color={COLORS.cyan}
              type="scale"
              delay={500}
            />
          </div>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
