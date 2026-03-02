"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Terminal, Trash2 } from "lucide-react";
import { qaConsole } from "@/lib/qa-studio/actions";
import { isActionError, type QaConsoleMessage } from "@/lib/qa-studio/types";

type PanelStatus = "idle" | "loading" | "success" | "error";

const LOG_LEVELS = [
  { value: "error", label: "Error" },
  { value: "warning", label: "Warning" },
  { value: "info", label: "Info" },
  { value: "debug", label: "Debug" },
] as const;

type LogLevel = "error" | "warning" | "info" | "debug";

function getLogBadgeVariant(type: string): "destructive" | "warning" | "default" | "outline" {
  switch (type) {
    case "error":
      return "destructive";
    case "warn":
    case "warning":
      return "warning";
    case "info":
    case "log":
      return "default";
    default:
      return "outline";
  }
}

function getLogTextColor(type: string): string {
  switch (type) {
    case "error":
      return "text-destructive";
    case "warn":
    case "warning":
      return "text-amber-400";
    case "info":
    case "log":
      return "text-blue-400";
    default:
      return "text-muted-foreground";
  }
}

export function ConsolePanel() {
  const [status, setStatus] = useState<PanelStatus>("idle");
  const [messages, setMessages] = useState<QaConsoleMessage[]>([]);
  const [level, setLevel] = useState<LogLevel>("info");
  const [error, setError] = useState<string | null>(null);
  const scrollEndRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const result = await qaConsole(level);
      if (isActionError(result)) {
        setError(result.error);
        setStatus("error");
        return;
      }
      setMessages(result);
      setStatus("success");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch console messages";
      setError(message);
      setStatus("error");
    }
  }, [level]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollEndRef.current) {
      scrollEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleClear = useCallback(() => {
    setMessages([]);
    setStatus("idle");
  }, []);

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/40">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Terminal className="h-4 w-4 text-primary" />
            Console
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={level} onValueChange={(v) => setLevel(v as LogLevel)}>
              <SelectTrigger className="h-7 text-xs w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOG_LEVELS.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={handleClear} className="h-7 px-2">
              <Trash2 className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              onClick={fetchMessages}
              disabled={status === "loading"}
              className="h-7"
            >
              {status === "loading" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Fetch"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {status === "error" && error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive mb-2">
            {error}
          </div>
        )}

        <ScrollArea className="h-[360px] rounded-lg border border-border/30 bg-black/20 p-1">
          <div className="space-y-0.5 p-2 font-mono text-xs">
            {messages.length === 0 && status !== "loading" && (
              <div className="flex items-center justify-center h-full py-12 text-muted-foreground text-xs">
                {status === "idle" ? "Click Fetch to load console messages" : "No console messages"}
              </div>
            )}
            {messages.map((msg, idx) => (
              <div
                key={`${msg.type}-${msg.line}-${idx}`}
                className="flex items-start gap-2 py-0.5 hover:bg-white/5 rounded px-1"
              >
                <Badge
                  variant={getLogBadgeVariant(msg.type)}
                  className="text-[10px] px-1.5 py-0 shrink-0 mt-0.5"
                >
                  {msg.type}
                </Badge>
                <span className={`flex-1 break-all ${getLogTextColor(msg.type)}`}>{msg.text}</span>
                {msg.url && (
                  <span className="text-muted-foreground/50 text-[10px] shrink-0">
                    {msg.url.split("/").pop()}:{msg.line}
                  </span>
                )}
              </div>
            ))}
            <div ref={scrollEndRef} />
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
