import { useState } from "react";
import { ChevronDown, ChevronRight, Wrench, AlertCircle, Copy, Check } from "lucide-react";
import type { ChatMessage as ChatMessageType } from "../../hooks/useChat";

interface ChatMessageProps {
  message: ChatMessageType;
}

function CopyButton({ text, isUser }: { text: string; isUser: boolean }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={`p-1.5 rounded-lg transition-all ${
        isUser
          ? "hover:bg-black/10 text-obsidian-900/50 hover:text-obsidian-900"
          : "hover:bg-white/5 text-gray-500 hover:text-gray-300"
      }`}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

function ToolCallCard({
  tc,
}: {
  tc: NonNullable<ChatMessageType["toolCalls"]>[number];
}) {
  const [expanded, setExpanded] = useState(false);
  const isImage = tc.result && /https?:\/\/.*\.(png|jpg|jpeg|webp|gif)/i.test(tc.result);
  const imageUrl = isImage ? tc.result!.match(/https?:\/\/[^\s"]+\.(png|jpg|jpeg|webp|gif)/i)?.[0] : null;

  return (
    <div className="mt-3 rounded-2xl border border-white/5 bg-obsidian-950/50 text-[11px] overflow-hidden transition-all">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left"
      >
        <div className="w-6 h-6 rounded-lg bg-emerald-neon/10 flex items-center justify-center shrink-0">
          <Wrench className="w-3 h-3 text-emerald-neon" />
        </div>
        <span className="font-bold text-gray-400 uppercase tracking-widest truncate">{tc.name.replace("img_", "PIXEL.")}</span>
        {tc.status === "pending" && (
          <span className="ml-auto flex items-center gap-1.5 text-amber-neon font-black uppercase tracking-tighter">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-neon animate-pulse" />
            Active
          </span>
        )}
        {tc.status === "error" && (
          <AlertCircle className="ml-auto w-3.5 h-3.5 text-red-500" />
        )}
        {tc.status === "done" && (
          <div className="ml-auto">
            {expanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-gray-600" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
            )}
          </div>
        )}
      </button>
      {expanded && tc.result && (
        <div className="px-4 py-4 border-t border-white/5 bg-obsidian-900/30">
          {imageUrl && (
            <div className="rounded-xl overflow-hidden border border-white/10 mb-3 shadow-2xl">
              <img
                src={imageUrl}
                alt="Generated Output"
                className="w-full h-auto max-h-64 object-cover"
              />
            </div>
          )}
          <pre className="text-gray-500 font-medium whitespace-pre-wrap break-all max-h-40 overflow-y-auto leading-relaxed">
            {tc.result.length > 1000 ? `${tc.result.slice(0, 1000)}...` : tc.result}
          </pre>
        </div>
      )}
    </div>
  );
}

function LoadingDots() {
  return (
    <span className="inline-flex gap-1.5 items-center px-2 py-1">
      <span className="w-1 h-1 bg-amber-neon rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
      <span className="w-1 h-1 bg-amber-neon rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
      <span className="w-1 h-1 bg-amber-neon rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
    </span>
  );
}

function SimpleMarkdown({ text, isUser }: { text: string; isUser: boolean }) {
  // Simple regex-based markdown-ish parser
  // Supports **bold**, _italic_, [link](url), and newlines
  const parts = text.split(/(\*\*.*?\*\*|_.*?_|\[.*?\]\(.*?\))/g);

  return (
    <span className="whitespace-pre-wrap">
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className={isUser ? "font-black" : "font-bold text-white"}>
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith("_") && part.endsWith("_")) {
          return <em key={i} className="italic">{part.slice(1, -1)}</em>;
        }
        const linkMatch = part.match(/\[(.*?)\]\((.*?)\)/);
        if (linkMatch) {
          return (
            <a
              key={i}
              href={linkMatch[2]}
              target="_blank"
              rel="noopener noreferrer"
              className={`${isUser ? "text-obsidian-900" : "text-amber-neon"} underline hover:opacity-80 transition-opacity`}
            >
              {linkMatch[1]}
            </a>
          );
        }
        return part;
      })}
    </span>
  );
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const isEmpty = !message.content && (!message.toolCalls || message.toolCalls.length === 0);

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} group`}>
      <div
        className={`relative max-w-[90%] rounded-3xl p-5 ${
          isUser
            ? "bg-amber-neon text-obsidian-950 rounded-tr-lg shadow-[0_10px_30px_rgba(255,170,0,0.1)]"
            : "glass-panel border-white/10 text-gray-200 rounded-tl-lg"
        }`}
      >
        {isEmpty ? (
          <LoadingDots />
        ) : (
          <div className="flex gap-4">
            <div className="flex-1 space-y-3 overflow-hidden">
              {message.content && (
                <div className={`text-sm ${isUser ? "font-bold" : "font-medium leading-relaxed"}`}>
                  <SimpleMarkdown text={message.content} isUser={isUser} />
                </div>
              )}
              {message.toolCalls && message.toolCalls.length > 0 && (
                <div className="space-y-2">
                  {message.toolCalls.map((tc, i) => (
                    <ToolCallCard key={`${tc.name}-${i}`} tc={tc} />
                  ))}
                </div>
              )}
            </div>
            {!isEmpty && (
              <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <CopyButton text={message.content || ""} isUser={isUser} />
              </div>
            )}
          </div>
        )}
        <div
          className={`text-[9px] font-black uppercase tracking-widest mt-3 opacity-40 ${
            isUser ? "text-obsidian-950 text-right" : "text-gray-500"
          }`}
        >
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
    </div>
  );
}
