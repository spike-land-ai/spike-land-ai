import { Link, useParams } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { type AppStatus, StatusBadge } from "@/components/StatusBadge";
import { ChatThread, type Message } from "@/components/ChatThread";
import { type AppVersion, VersionHistory } from "@/components/VersionHistory";
import { LivePreview } from "@/components/LivePreview";

const tabs = ["Chat", "Versions", "Preview"] as const;
type Tab = (typeof tabs)[number];

// Placeholder data until real-time subscriptions are wired
const placeholderVersions: AppVersion[] = [
  {
    version: 1,
    changeDescription: "Initial version - scaffolded from prompt",
    author: "agent",
    timestamp: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    version: 2,
    changeDescription: "Added responsive layout and dark mode support",
    author: "agent",
    timestamp: new Date(Date.now() - 3600000).toISOString(),
  },
];

export function AppDetailPage() {
  const { appId } = useParams({ strict: false });
  const [activeTab, setActiveTab] = useState<Tab>("Chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [appStatus] = useState<AppStatus>("live");

  const handleSendMessage = useCallback(
    (content: string) => {
      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      // Simulate assistant response
      setTimeout(() => {
        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `I received your message about "${content.slice(
            0,
            50,
          )}...". I'll work on that change now.`,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setIsLoading(false);
      }, 1500);
    },
    [appId],
  );

  function handleAction(_action: "archive" | "delete" | "restore") {
    // TODO: wire up to edge API
  }

  return (
    <div className="flex h-full flex-col space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/apps" className="text-blue-600 hover:underline">
            Apps
          </Link>
          <span className="text-gray-400">/</span>
          <h1 className="text-2xl font-bold">{appId}</h1>
          <StatusBadge status={appStatus} />
        </div>
        <div className="flex gap-2">
          {appStatus === "live" && (
            <button
              onClick={() => handleAction("archive")}
              className="rounded-lg border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              Archive
            </button>
          )}
          {appStatus === "archived" && (
            <button
              onClick={() => handleAction("restore")}
              className="rounded-lg border px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50"
            >
              Restore
            </button>
          )}
          <button
            onClick={() => handleAction("delete")}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition ${
              activeTab === tab
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="min-h-0 flex-1 rounded-xl border bg-white">
        {activeTab === "Chat" && (
          <ChatThread messages={messages} onSendMessage={handleSendMessage} isLoading={isLoading} />
        )}
        {activeTab === "Versions" && (
          <div className="p-6">
            <VersionHistory versions={placeholderVersions} />
          </div>
        )}
        {activeTab === "Preview" && <LivePreview appId={appId ?? ""} />}
      </div>
    </div>
  );
}
