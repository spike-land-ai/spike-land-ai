import type { RadixMessage } from "./useRadixChat";

/** Lightweight inline markdown → HTML (bold, italic, code, links, lists). */
function renderMarkdown(text: string): string {
  let html = text
    // Escape HTML entities
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Code blocks (``` ... ```)
    .replace(
      /```(\w*)\n([\s\S]*?)```/g,
      (_m, _lang, code) =>
        `<pre style="background:rgba(0,0,0,0.06);padding:0.75rem;border-radius:0.375rem;overflow-x:auto;font-size:0.8125rem;margin:0.5rem 0"><code>${code.trim()}</code></pre>`,
    )
    // Inline code
    .replace(
      /`([^`]+)`/g,
      '<code style="background:rgba(0,0,0,0.06);padding:0.125rem 0.375rem;border-radius:0.25rem;font-size:0.85em">$1</code>',
    )
    // Bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Italic
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Links
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:underline">$1</a>',
    )
    // Line breaks
    .replace(/\n/g, "<br />");

  // Simple unordered lists (- item)
  html = html.replace(/(?:^|<br \/>)((?:- .+?(?:<br \/>|$))+)/g, (_m, items: string) => {
    const lis = items
      .split("<br />")
      .filter((l: string) => l.startsWith("- "))
      .map((l: string) => `<li>${l.slice(2)}</li>`)
      .join("");
    return `<ul style="margin:0.5rem 0;padding-left:1.25rem">${lis}</ul>`;
  });

  return html;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface Props {
  message: RadixMessage;
  accent?: string;
}

export function RadixMessageBubble({ message, accent = "#0d9488" }: Props) {
  const isUser = message.role === "user";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        marginBottom: "0.25rem",
      }}
    >
      <div style={{ maxWidth: "85%" }}>
        <div
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "1rem",
            ...(isUser
              ? {
                  background: accent,
                  color: "#fff",
                  borderBottomRightRadius: "0.25rem",
                }
              : {
                  background: "rgba(0,0,0,0.05)",
                  color: "inherit",
                  borderBottomLeftRadius: "0.25rem",
                }),
            fontSize: "0.9375rem",
            lineHeight: "1.55",
            wordBreak: "break-word" as const,
          }}
          {...(!isUser
            ? { dangerouslySetInnerHTML: { __html: renderMarkdown(message.content) } }
            : { children: message.content })}
        />
        <div
          style={{
            fontSize: "0.6875rem",
            color: "rgba(0,0,0,0.4)",
            marginTop: "0.25rem",
            textAlign: isUser ? "right" : "left",
            paddingInline: "0.25rem",
          }}
        >
          {formatTime(message.timestamp)}
        </div>
      </div>
    </div>
  );
}
