import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { MessageCircle, X, Send, Trash2, Sparkles } from "lucide-react";
import { useChat } from "../../hooks/useChat";
import { ChatMessage } from "./ChatMessage";

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const { messages, sendMessage, isStreaming, error, clearError, clearMessages } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    sendMessage(input);
    setInput("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className={`fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-8 right-6 md:right-8 z-[120] w-14 h-14 md:w-16 md:h-16 rounded-2xl md:rounded-3xl flex items-center justify-center shadow-2xl transition-all duration-500 group ${
          open
            ? "bg-obsidian-800 hover:bg-obsidian-700 rotate-90 scale-90"
            : "bg-amber-neon hover:bg-amber-neon shadow-[0_0_30px_rgba(255,170,0,0.4)] scale-100 hover:scale-110 active:scale-95"
        }`}
        aria-label={open ? "Close chat" : "Open chat"}
      >
        {open ? (
          <X className="w-5 h-5 md:w-6 md:h-6 text-gray-300" />
        ) : (
          <MessageCircle className="w-6 h-6 md:w-7 md:h-7 text-obsidian-950 stroke-[2.5]" />
        )}
      </button>

      {/* Chat panel */}
      <div
        className={`fixed bottom-[calc(9.5rem+env(safe-area-inset-bottom))] md:bottom-28 right-4 md:right-8 z-[120] w-[calc(100vw-2rem)] sm:w-[440px] h-[600px] md:h-[650px] max-h-[65dvh] md:max-h-[85dvh] flex flex-col glass-panel rounded-[2.5rem] border-white/10 shadow-[0_30px_100px_rgba(0,0,0,0.8)] transition-all duration-500 origin-bottom-right ${
          open
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-95 translate-y-10 pointer-events-none"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-white/5 bg-white/5 rounded-t-[2.5rem]">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-3 h-3 rounded-full bg-emerald-neon animate-pulse" />
              <div className="absolute inset-0 w-3 h-3 rounded-full bg-emerald-neon animate-ping opacity-20" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Neural Partner</span>
              <h3 className="text-sm font-bold text-white tracking-tight">Studio Intelligence</h3>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {messages.length > 0 && (
              <button
                onClick={clearMessages}
                className="p-2.5 rounded-xl hover:bg-white/5 text-gray-500 hover:text-red-400 transition-all active:scale-90"
                title="Wipe Memory"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="p-2.5 rounded-xl hover:bg-white/5 text-gray-500 hover:text-white transition-all active:scale-90"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 nice-scrollbar">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-40">
              <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-amber-neon" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-bold text-white tracking-tight">How shall we evolve your vision?</p>
                <p className="text-xs font-medium text-gray-500 leading-relaxed max-w-[200px]">
                  I can manifest assets, enhance frames, and orchestrate complex canvas workflows.
                </p>
              </div>
            </div>
          )}
          <div className="space-y-6">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-8 mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-[11px] font-bold text-red-400 flex justify-between items-center animate-in slide-in-from-bottom-2">
            <span className="flex-1 mr-4">{error}</span>
            <button onClick={clearError} className="p-1.5 hover:bg-white/5 rounded-lg transition-colors">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Input */}
        <div className="p-6 border-t border-white/5 bg-white/5 rounded-b-[2.5rem]">
          <div className="relative flex items-end gap-3 glass-panel border-white/10 rounded-2xl p-2 focus-within:ring-1 ring-amber-neon/30 transition-all">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe a creative leap..."
              rows={1}
              className="flex-1 bg-transparent border-none outline-none px-4 py-3 text-sm text-white placeholder:text-gray-600 resize-none max-h-32 font-medium"
              style={{ minHeight: "44px" }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              className="p-3.5 rounded-xl bg-amber-neon text-obsidian-950 disabled:opacity-20 disabled:grayscale transition-all active:scale-90 shadow-[0_0_20px_rgba(255,170,0,0.2)]"
            >
              {isStreaming ? (
                <div className="w-4 h-4 border-2 border-obsidian-950/20 border-t-obsidian-950 rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4 stroke-[3]" />
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
