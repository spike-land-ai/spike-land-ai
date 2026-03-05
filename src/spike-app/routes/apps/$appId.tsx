import { Link, useParams, useSearch, useNavigate } from "@tanstack/react-router";
import { useCallback, useState, useEffect, lazy, Suspense } from "react";
import { type AppStatus, StatusBadge } from "@/components/StatusBadge";
import { ChatThread, type Message } from "@/components/ChatThread";
import { type AppVersion, VersionHistory } from "@/components/VersionHistory";
import { AppProductPage } from "@/components/AppProductPage";
import { ScrollContainer } from "@spike-land-ai/shared";

const McpTerminal = lazy(() =>
  import("@/components/McpTerminal").then((m) => ({ default: m.McpTerminal })),
);

const tabs = ["Overview", "Terminal", "Chat", "Versions"] as const;
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
  const search = useSearch({ from: "/apps/$appId" }) as { tab?: Tab };
  const navigate = useNavigate();

  const activeTab = tabs.includes(search.tab as Tab) ? (search.tab as Tab) : "Overview";
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [appStatus] = useState<AppStatus>("live");

  const setActiveTab = useCallback((tab: Tab) => {
    navigate({
      to: "/apps/$appId",
      params: { appId: appId ?? "" },
      search: (prev) => ({ ...prev, tab }),
    });
  }, [navigate, appId]);

  useEffect(() => {
    const handleTabChange = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (tabs.includes(customEvent.detail as Tab)) {
        setActiveTab(customEvent.detail as Tab);
      }
    };
    window.addEventListener("change-tab", handleTabChange);
    return () => window.removeEventListener("change-tab", handleTabChange);
  }, [setActiveTab]);

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
    [],
  );

  function handleAction(_action: "archive" | "delete" | "restore") {
    // TODO: wire up to edge API
  }

  return (
    <div className="flex h-full flex-col space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/apps" className="text-primary hover:underline">
            MCP Tools
          </Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="text-2xl font-bold text-foreground">{appId}</h1>
          <StatusBadge status={appStatus} />
          <span className="rounded bg-info/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-info-foreground">
            MCP
          </span>
        </div>
        <div className="flex gap-2">
          {appStatus === "live" && (
            <button
              onClick={() => handleAction("archive")}
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
            >
              Archive
            </button>
          )}
          {appStatus === "archived" && (
            <button
              onClick={() => handleAction("restore")}
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-primary hover:bg-muted"
            >
              Restore
            </button>
          )}
          <button
            onClick={() => handleAction("delete")}
            className="rounded-lg border border-destructive/30 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition ${
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <ScrollContainer className="rounded-xl border border-border bg-card">
        {activeTab === "Overview" && <AppProductPage appId={appId ?? ""} />}
        {activeTab === "Terminal" && (
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center bg-muted text-muted-foreground">
                Loading terminal...
              </div>
            }
          >
            <McpTerminal appId={appId} />
          </Suspense>
        )}
        {activeTab === "Chat" && (
          <ChatThread messages={messages} onSendMessage={handleSendMessage} isLoading={isLoading} />
        )}
        {activeTab === "Versions" && (
          <div className="p-6">
            <VersionHistory versions={placeholderVersions} />
          </div>
        )}
      </ScrollContainer>
    </div>
  );
}
