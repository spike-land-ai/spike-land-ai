"use client";

import { cn } from "@/lib/utils";

type AgentType = "researcher" | "coder" | "reviewer" | "coordinator" | "specialist";
type AgentStatus = "active" | "idle" | "completed" | "failed";

interface AgentNode {
  id: string;
  name: string;
  type: AgentType;
  status: AgentStatus;
}

interface AgentConnection {
  from: string;
  to: string;
  label?: string;
}

interface AgentTopologyDiagramProps {
  agents: AgentNode[];
  connections: AgentConnection[];
}

const statusDotClass: Record<AgentStatus, string> = {
  active: "bg-green-400 animate-pulse",
  idle: "bg-zinc-500",
  completed: "bg-blue-400",
  failed: "bg-red-400",
};

const agentTypeColor: Record<AgentType, string> = {
  researcher: "border-violet-500/40 bg-violet-500/5",
  coder: "border-cyan-500/40 bg-cyan-500/5",
  reviewer: "border-amber-500/40 bg-amber-500/5",
  coordinator: "border-pink-500/40 bg-pink-500/5",
  specialist: "border-emerald-500/40 bg-emerald-500/5",
};

const agentTypeLabel: Record<AgentType, string> = {
  researcher: "text-violet-400",
  coder: "text-cyan-400",
  reviewer: "text-amber-400",
  coordinator: "text-pink-400",
  specialist: "text-emerald-400",
};

function AgentNodeBubble({ agent }: { agent: AgentNode }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1 rounded-xl border px-3 py-2 w-28 shrink-0",
        agentTypeColor[agent.type],
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className={cn("h-1.5 w-1.5 rounded-full", statusDotClass[agent.status])} />
        <span className={cn("text-xs font-semibold truncate", agentTypeLabel[agent.type])}>
          {agent.name}
        </span>
      </div>
      <span className="text-[10px] text-zinc-500 truncate w-full text-center">{agent.type}</span>
    </div>
  );
}

function ConnectionArrow({ label }: { label?: string | undefined }) {
  return (
    <div className="flex flex-col items-center justify-center shrink-0 px-1 min-w-[40px]">
      <div className="flex items-center gap-0">
        <div className="h-px w-6 bg-zinc-600" />
        <svg width="8" height="8" viewBox="0 0 8 8" className="text-zinc-500 fill-current shrink-0">
          <polygon points="0,0 8,4 0,8" />
        </svg>
      </div>
      {label && <span className="text-[9px] text-zinc-600 mt-0.5 whitespace-nowrap">{label}</span>}
    </div>
  );
}

export function AgentTopologyDiagram({ agents, connections }: AgentTopologyDiagramProps) {
  const agentMap = new Map(agents.map((a) => [a.id, a]));

  // Build rows: coordinator on top, then grouped by connections
  const coordinators = agents.filter((a) => a.type === "coordinator");
  const nonCoordinators = agents.filter((a) => a.type !== "coordinator");

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 space-y-6">
      {/* Coordinator row */}
      {coordinators.length > 0 && (
        <div className="flex justify-center gap-4 flex-wrap">
          {coordinators.map((agent) => (
            <AgentNodeBubble key={agent.id} agent={agent} />
          ))}
        </div>
      )}

      {/* Connector lines downward */}
      {coordinators.length > 0 && nonCoordinators.length > 0 && (
        <div className="flex justify-center">
          <div className="w-px h-6 bg-zinc-700" />
        </div>
      )}

      {/* Worker agents row */}
      {nonCoordinators.length > 0 && (
        <div className="flex justify-center gap-3 flex-wrap">
          {nonCoordinators.map((agent) => (
            <AgentNodeBubble key={agent.id} agent={agent} />
          ))}
        </div>
      )}

      {/* Connection list */}
      {connections.length > 0 && (
        <div className="border-t border-zinc-800 pt-4 space-y-2">
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-mono">
            Active Connections
          </p>
          <div className="flex flex-col gap-2">
            {connections.map((conn, i) => {
              const fromAgent = agentMap.get(conn.from);
              const toAgent = agentMap.get(conn.to);
              if (!fromAgent || !toAgent) return null;
              return (
                <div key={i} className="flex items-center gap-1 text-xs text-zinc-400">
                  <span className={cn("font-medium", agentTypeLabel[fromAgent.type])}>
                    {fromAgent.name}
                  </span>
                  <ConnectionArrow label={conn.label} />
                  <span className={cn("font-medium", agentTypeLabel[toAgent.type])}>
                    {toAgent.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
