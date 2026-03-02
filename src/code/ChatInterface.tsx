import type { ICode, Message } from "@/lib/interfaces";
import React, { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";

interface ChatInterfaceProps {
  isOpen: boolean;
  codeSession: ICode;
  codeSpace: string;
  onClose: () => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = React.memo(({ isOpen, codeSession, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!codeSession) return;
    
    // Initial fetch
    codeSession.getSession().then((sess) => {
      setMessages(sess.messages || []);
    });

    // Subscribe to changes
    const unsubscribe = codeSession.sub((sess) => {
      setMessages(sess.messages || []);
    });

    return () => unsubscribe();
  }, [codeSession]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const newMessage: Message = {
      id: Math.random().toString(36).substring(7),
      role: "user",
      content: input,
    };

    setInput("");
    await codeSession.addMessage(newMessage);
  };

  if (!isOpen) return null;

  return (
    <div className="flex flex-col h-full w-full bg-background border-l border-border/10">
      <div className="flex items-center justify-between p-3 border-b border-border/10 bg-card/50">
        <h2 className="text-sm font-semibold text-foreground">Assistant</h2>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-white/10 text-muted-foreground transition-colors"
          aria-label="Close"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            How can I help you code?
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-none"
                    : "bg-muted text-foreground rounded-tl-none"
                }`}
              >
                {typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content)}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-3 border-t border-border/10 bg-card/50">
        <form onSubmit={handleSend} className="relative flex items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend(e);
              }
            }}
            placeholder="Ask me anything..."
            className="w-full bg-background border border-border/20 rounded-lg pl-3 pr-10 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none max-h-32 min-h-[44px]"
            rows={1}
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="absolute right-2 bottom-2 p-1 text-primary hover:text-primary/80 disabled:opacity-50 transition-colors"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
});

ChatInterface.displayName = "ChatInterface";
