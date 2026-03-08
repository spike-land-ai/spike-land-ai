import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { typewriter } from "../../lib/animations";
import { COLORS, SPRING_CONFIGS } from "../../../core-logic/constants";

type CodeBlockProps = {
  code: string;
  language?: string;
  delay?: number;
  typingSpeed?: number;
  borderColor?: string;
};

// Token types for simple syntax highlighting
type TokenType = "keyword" | "string" | "number" | "comment" | "text";

type Token = {
  type: TokenType;
  value: string;
};

// Simple tokenizer for syntax highlighting (safe - renders as React elements)
function tokenize(code: string): Token[] {
  const tokens: Token[] = [];
  const keywords =
    /\b(const|let|var|function|return|import|from|export|async|await|if|else|for|while)\b/g;
  const strings = /(".*?"|'.*?'|`[^`]*`)/g;
  const numbers = /\b(\d+)\b/g;
  const comments = /(\/\/.*)/g;

  let remaining = code;
  let match;

  while (remaining.length > 0) {
    let earliest = {
      index: remaining.length,
      length: 0,
      type: "text" as TokenType,
      value: "",
    };

    // Check for keywords
    keywords.lastIndex = 0;
    if ((match = keywords.exec(remaining)) !== null && match.index < earliest.index) {
      earliest = {
        index: match.index,
        length: match[0].length,
        type: "keyword",
        value: match[0],
      };
    }

    // Check for strings
    strings.lastIndex = 0;
    if ((match = strings.exec(remaining)) !== null && match.index < earliest.index) {
      earliest = {
        index: match.index,
        length: match[0].length,
        type: "string",
        value: match[0],
      };
    }

    // Check for numbers
    numbers.lastIndex = 0;
    if ((match = numbers.exec(remaining)) !== null && match.index < earliest.index) {
      earliest = {
        index: match.index,
        length: match[0].length,
        type: "number",
        value: match[0],
      };
    }

    // Check for comments
    comments.lastIndex = 0;
    if ((match = comments.exec(remaining)) !== null && match.index < earliest.index) {
      earliest = {
        index: match.index,
        length: match[0].length,
        type: "comment",
        value: match[0],
      };
    }

    if (earliest.index > 0) {
      tokens.push({ type: "text", value: remaining.slice(0, earliest.index) });
    }

    if (earliest.length > 0) {
      tokens.push({ type: earliest.type, value: earliest.value });
      remaining = remaining.slice(earliest.index + earliest.length);
    } else {
      if (remaining.length > 0) {
        tokens.push({ type: "text", value: remaining });
      }
      break;
    }
  }

  return tokens;
}

const TOKEN_COLORS: Record<TokenType, string> = {
  keyword: "#FF79C6",
  string: "#F1FA8C",
  number: "#BD93F9",
  comment: "#6272A4",
  text: "#f8f8f2",
};

export function CodeBlock({
  code,
  language = "tsx",
  delay = 0,
  typingSpeed = 60,
  borderColor = COLORS.darkBorder,
}: CodeBlockProps) {
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

  const translateY = interpolate(entryProgress, [0, 1], [10, 0]);

  const visibleCode = typewriter(frame, fps, code, typingSpeed, delay + 5);
  const tokens = tokenize(visibleCode);

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
        backgroundColor: "#1a1a2e",
        borderRadius: 8,
        overflow: "hidden",
        border: `1px solid ${borderColor}`,
        fontFamily: "JetBrains Mono, monospace",
      }}
    >
      {/* Header bar */}
      <div
        style={{
          padding: "8px 12px",
          backgroundColor: COLORS.darkBorder,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", gap: 6 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              backgroundColor: "#ff5f56",
            }}
          />
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              backgroundColor: "#ffbd2e",
            }}
          />
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              backgroundColor: "#27ca3f",
            }}
          />
        </div>
        <span
          style={{
            fontSize: 12,
            color: COLORS.textMuted,
            marginLeft: 8,
          }}
        >
          {language}
        </span>
      </div>

      {/* Code content - rendered as safe React elements */}
      <div
        style={{
          padding: "16px",
          fontSize: 14,
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
          overflowX: "auto",
        }}
      >
        {tokens.map((token, i) => (
          <span key={i} style={{ color: TOKEN_COLORS[token.type] }}>
            {token.value}
          </span>
        ))}
      </div>
    </div>
  );
}
