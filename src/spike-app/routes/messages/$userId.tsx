import { Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { ScrollContainer } from "@spike-land-ai/shared";

const placeholderMessages = [
  {
    id: 1,
    from: "them",
    text: "Hey, have you seen the latest build?",
    time: "10:30 AM",
  },
  {
    id: 2,
    from: "me",
    text: "Yes, looks great! The performance improved.",
    time: "10:32 AM",
  },
  {
    id: 3,
    from: "them",
    text: "Awesome. Let me push the final changes.",
    time: "10:35 AM",
  },
];

export function MessageThreadPage() {
  const { userId } = useParams({ strict: false });
  const [input, setInput] = useState("");

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <Link to="/messages" className="text-primary hover:underline">
          Messages
        </Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-lg font-bold capitalize text-foreground">{userId}</h1>
      </div>

      <ScrollContainer className="space-y-3 py-4">
        {placeholderMessages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.from === "me" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-xs rounded-2xl px-4 py-2 ${
                msg.from === "me" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
              }`}
            >
              <p className="text-sm">{msg.text}</p>
              <p
                className={`mt-1 text-xs ${msg.from === "me" ? "text-primary-foreground/70" : "text-muted-foreground"}`}
              >
                {msg.time}
              </p>
            </div>
          </div>
        ))}
      </ScrollContainer>

      <div className="flex gap-2 border-t border-border pt-4">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 transition-colors">
          Send
        </button>
      </div>
    </div>
  );
}
