import { useEffect, useRef } from "react";
import { useRadixChat } from "./useRadixChat";
import type { PipelineStage } from "./useRadixChat";
import { RadixMessageBubble } from "./RadixMessageBubble";
import { RadixChatInput } from "./RadixChatInput";

const STAGE_LABELS: Record<PipelineStage, string> = {
  classify: "Classifying...",
  plan: "Planning...",
  execute: "Executing...",
  extract: "Extracting...",
  idle: "",
};

interface PersonaConfig {
  persona: string;
  title: string;
  accent: string;
  greeting: string;
  subtitle: string;
  placeholder: string;
  suggestions: string[];
}

const PERSONAS: Record<string, PersonaConfig> = {
  radix: {
    persona: "radix",
    title: "Radix",
    accent: "#0d9488",
    greeting: "Az agyam nyitva all.",
    subtitle: "My brain is open. What is the root of your problem?",
    placeholder: "Message Radix...",
    suggestions: [
      "What is the root of spike.land?",
      "Explain the Strange Loop audit",
      "What is the BAZDMEG method?",
    ],
  },
  erdos: {
    persona: "erdos",
    title: "Erdos",
    accent: "#7c3aed",
    greeting: "My brain is open.",
    subtitle: "What is your problem? — Not as therapy, as collaboration.",
    placeholder: "Message Erdos...",
    suggestions: [
      "Give me a beautiful problem",
      "What makes a proof from The Book?",
      "Tell me about collaboration graphs",
    ],
  },
};

interface Props {
  persona?: string;
}

export default function RadixChat({ persona = "radix" }: Props) {
  const config = PERSONAS[persona] ?? PERSONAS["radix"];
  const { messages, sendMessage, isStreaming, currentStage, error, clearError, clearMessages } =
    useRadixChat(config.persona);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        width: "100%",
        background: "#fafafa",
        color: "#1a1a1a",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        overscrollBehavior: "contain",
      }}
    >
      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: "48px",
          padding: "0 1rem",
          paddingTop: "env(safe-area-inset-top, 0px)",
          borderBottom: "1px solid rgba(0,0,0,0.08)",
          background: "#fff",
          flexShrink: 0,
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "1.125rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
            {config.title}
          </span>
          <span
            style={{
              width: "0.5rem",
              height: "0.5rem",
              borderRadius: "50%",
              background: "#10b981",
              display: "inline-block",
            }}
          />
        </div>
        <button
          type="button"
          onClick={clearMessages}
          style={{
            padding: "0.375rem 0.75rem",
            fontSize: "0.8125rem",
            fontWeight: 500,
            border: "1px solid rgba(0,0,0,0.12)",
            borderRadius: "0.5rem",
            background: "transparent",
            color: "inherit",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Clear
        </button>
      </header>

      {/* Error bar */}
      {error && (
        <div
          style={{
            padding: "0.5rem 1rem",
            background: "#fef2f2",
            color: "#dc2626",
            fontSize: "0.8125rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={clearError}
            style={{
              border: "none",
              background: "transparent",
              color: "inherit",
              cursor: "pointer",
              fontSize: "1rem",
              lineHeight: 1,
            }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Stage indicator */}
      {currentStage !== "idle" && (
        <div
          style={{
            padding: "0.375rem 1rem",
            background: `${config.accent}0f`,
            color: config.accent,
            fontSize: "0.75rem",
            fontWeight: 600,
            letterSpacing: "0.03em",
            textTransform: "uppercase",
            flexShrink: 0,
          }}
        >
          {STAGE_LABELS[currentStage]}
        </div>
      )}

      {/* Message list */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              gap: "1.5rem",
              padding: "2rem 1rem",
            }}
          >
            <div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>
                {config.greeting}
              </div>
              <div style={{ fontSize: "0.9375rem", color: "rgba(0,0,0,0.5)", lineHeight: "1.5" }}>
                {config.subtitle}
              </div>
            </div>
            <div
              style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", justifyContent: "center" }}
            >
              {config.suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => sendMessage(s)}
                  style={{
                    padding: "0.5rem 1rem",
                    fontSize: "0.8125rem",
                    border: "1px solid rgba(0,0,0,0.12)",
                    borderRadius: "999px",
                    background: "#fff",
                    color: "inherit",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition: "background 0.15s",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <RadixMessageBubble key={msg.id} message={msg} accent={config.accent} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <RadixChatInput
        onSend={sendMessage}
        disabled={isStreaming}
        accent={config.accent}
        placeholder={config.placeholder}
      />
    </div>
  );
}
