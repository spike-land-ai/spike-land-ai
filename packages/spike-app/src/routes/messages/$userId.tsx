import { useParams, Link } from "@tanstack/react-router";
import { useState } from "react";

const placeholderMessages = [
  { id: 1, from: "them", text: "Hey, have you seen the latest build?", time: "10:30 AM" },
  { id: 2, from: "me", text: "Yes, looks great! The performance improved.", time: "10:32 AM" },
  { id: 3, from: "them", text: "Awesome. Let me push the final changes.", time: "10:35 AM" },
];

export function MessageThreadPage() {
  const { userId } = useParams({ strict: false });
  const [input, setInput] = useState("");

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b pb-4">
        <Link to="/messages" className="text-blue-600 hover:underline">
          Messages
        </Link>
        <span className="text-gray-400">/</span>
        <h1 className="text-lg font-bold capitalize">{userId}</h1>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto py-4">
        {placeholderMessages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.from === "me" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-xs rounded-2xl px-4 py-2 ${
                msg.from === "me" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-900"
              }`}
            >
              <p className="text-sm">{msg.text}</p>
              <p
                className={`mt-1 text-xs ${msg.from === "me" ? "text-blue-200" : "text-gray-400"}`}
              >
                {msg.time}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 border-t pt-4">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 rounded-lg border px-4 py-2"
        />
        <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
          Send
        </button>
      </div>
    </div>
  );
}
