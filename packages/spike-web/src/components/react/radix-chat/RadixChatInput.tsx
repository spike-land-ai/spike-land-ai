import { useState, useRef, useCallback } from "react";

interface Props {
  onSend: (message: string) => void;
  disabled: boolean;
  accent?: string;
  placeholder?: string;
}

export function RadixChatInput({
  onSend,
  disabled,
  accent = "#0d9488",
  placeholder = "Message...",
}: Props) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    navigator.vibrate?.(10);
  }, [value, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const handleInput = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  const isActive = !disabled && value.trim().length > 0;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: "0.5rem",
        padding: "0.75rem",
        paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))",
        borderTop: "1px solid rgba(0,0,0,0.08)",
        background: "#fff",
      }}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        enterKeyHint="send"
        rows={1}
        style={{
          flex: 1,
          minHeight: "44px",
          maxHeight: "120px",
          padding: "0.625rem 0.875rem",
          fontSize: "max(16px, 1em)",
          lineHeight: "1.45",
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: "1.25rem",
          background: "rgba(0,0,0,0.03)",
          color: "inherit",
          resize: "none",
          outline: "none",
          fontFamily: "inherit",
        }}
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!isActive}
        aria-label="Send message"
        style={{
          minWidth: "44px",
          minHeight: "44px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "50%",
          border: "none",
          background: isActive ? accent : "rgba(0,0,0,0.12)",
          color: isActive ? "#fff" : "rgba(0,0,0,0.3)",
          cursor: isActive ? "pointer" : "not-allowed",
          transition: "background 0.15s, color 0.15s",
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M22 2L11 13" />
          <path d="M22 2l-7 20-4-9-9-4z" />
        </svg>
      </button>
    </div>
  );
}
