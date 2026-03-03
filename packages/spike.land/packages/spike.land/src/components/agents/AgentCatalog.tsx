"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { tryCatch } from "@/lib/try-catch";
import { cn } from "@/lib/utils";
import type { AgentListResponse, AgentResponse } from "@/lib/validations/agent";
import { Bot, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AgentCard } from "./AgentCard";
import { AgentStatsCard } from "./AgentStatsCard";
import { RenameAgentDialog } from "./RenameAgentDialog";
import { SendTaskDialog } from "./SendTaskDialog";
import { type AgentSSEEvent, useAgentSSE } from "./useAgentSSE";

interface AgentCatalogProps {
  initialData: AgentListResponse;
}

export function AgentCatalog({ initialData }: AgentCatalogProps) {
  const [data, setData] = useState<AgentListResponse>(initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Dialog state
  const [selectedAgent, setSelectedAgent] = useState<AgentResponse | null>(
    null,
  );
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [sendTaskDialogOpen, setSendTaskDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);

  // Fetch agents
  const fetchAgents = useCallback(async () => {
    setIsRefreshing(true);
    const { data: response, error } = await tryCatch(
      fetch("/api/agents").then(r => r.json() as Promise<AgentListResponse>),
    );

    if (!error && response) {
      setData(response);
    }
    setIsRefreshing(false);
  }, []);

  // Handle SSE events
  const handleSSEEvent = useCallback((event: AgentSSEEvent) => {
    // Refresh data on any agent event
    if (
      event.type === "agent_connected"
      || event.type === "agent_disconnected"
      || event.type === "agent_status_changed"
    ) {
      fetchAgents();
    }
  }, [fetchAgents]);

  // SSE connection
  const { isConnected } = useAgentSSE({
    onEvent: handleSSEEvent,
    enabled: true,
  });

  // Refresh every 30 seconds as fallback
  useEffect(() => {
    const interval = setInterval(fetchAgents, 30000);
    return () => clearInterval(interval);
  }, [fetchAgents]);

  // Actions
  const handleRename = (agent: AgentResponse) => {
    setSelectedAgent(agent);
    setRenameDialogOpen(true);
  };

  const handleSendTask = (agent: AgentResponse) => {
    setSelectedAgent(agent);
    setSendTaskDialogOpen(true);
  };

  const handleDisconnect = (agent: AgentResponse) => {
    setSelectedAgent(agent);
    setDisconnectDialogOpen(true);
  };

  const handleDelete = (agent: AgentResponse) => {
    setSelectedAgent(agent);
    setDeleteDialogOpen(true);
  };

  // API calls
  const renameAgent = async (agentId: string, displayName: string) => {
    const response = await fetch(`/api/agents/${agentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to rename agent");
    }

    await fetchAgents();
  };

  const sendTask = async (agentId: string, prompt: string) => {
    const response = await fetch(`/api/agents/${agentId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to send task");
    }

    await fetchAgents();
  };

  const disconnectAgent = async () => {
    if (!selectedAgent) return;

    try {
      const response = await fetch(`/api/agents/${selectedAgent.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to disconnect agent");
      }

      toast.success(`${selectedAgent.displayName} disconnected`);
      setDisconnectDialogOpen(false);
      await fetchAgents();
    } catch (err) {
      console.error("Failed to disconnect agent:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to disconnect agent",
      );
    }
  };

  const deleteAgent = async () => {
    if (!selectedAgent) return;

    try {
      const response = await fetch(
        `/api/agents/${selectedAgent.id}?permanent=true`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete agent");
      }

      toast.success(`${selectedAgent.displayName} deleted`);
      setDeleteDialogOpen(false);
      await fetchAgents();
    } catch (err) {
      console.error("Failed to delete agent:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to delete agent",
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Connected Agents</h1>
          <p className="text-muted-foreground">
            Manage your Claude Code agents
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Connection status */}
          <div
            className={cn(
              "flex items-center gap-1 text-xs px-2 py-1 rounded-full",
              isConnected
                ? "bg-aurora-green/10 text-aurora-green"
                : "bg-muted text-muted-foreground",
            )}
          >
            {isConnected
              ? <Wifi className="h-3 w-3" />
              : <WifiOff className="h-3 w-3" />}
            <span>{isConnected ? "Live" : "Polling"}</span>
          </div>

          {/* Refresh button */}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAgents}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={cn("h-4 w-4 mr-1", isRefreshing && "animate-spin")}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <AgentStatsCard stats={data.stats} />

      {/* Agent grid */}
      {data.agents.length === 0
        ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Bot className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">No agents connected</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-1">
              Connect a Claude Code agent to see it here. Agents will appear automatically when they
              call the connect endpoint.
            </p>
          </div>
        )
        : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.agents.map(agent => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onRename={handleRename}
                onSendTask={handleSendTask}
                onDisconnect={handleDisconnect}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

      {/* Dialogs */}
      <RenameAgentDialog
        agent={selectedAgent}
        open={renameDialogOpen}
        onOpenChange={setRenameDialogOpen}
        onRename={renameAgent}
      />

      <SendTaskDialog
        agent={selectedAgent}
        open={sendTaskDialogOpen}
        onOpenChange={setSendTaskDialogOpen}
        onSend={sendTask}
      />

      {/* Disconnect confirmation */}
      <AlertDialog
        open={disconnectDialogOpen}
        onOpenChange={setDisconnectDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Agent?</AlertDialogTitle>
            <AlertDialogDescription>
              This will disconnect{" "}
              {selectedAgent?.displayName}. The agent can reconnect later by calling the connect
              endpoint again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={disconnectAgent}>
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agent?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedAgent?.displayName}{" "}
              and all its history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteAgent}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
