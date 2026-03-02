// Agent types
export type AgentStatus = "active" | "idle" | "error" | "stopped";

export interface SwarmAgent {
  id: string;
  displayName: string;
  status: AgentStatus;
  machineId: string;
  sessionId: string;
  projectPath: string | null;
  workingDirectory: string | null;
  lastSeenAt: Date | null;
  totalTokensUsed: number;
  totalTasksCompleted: number;
  totalSessionTime: number;
  messageCount: number;
  createdAt: Date;
}

export interface AgentTimeline {
  agentId: string;
  entries: Array<{
    action: string;
    actionType: string;
    timestamp: Date;
    durationMs: number;
    isError: boolean;
  }>;
}

// Environment types
export type EnvironmentName = "dev" | "preview" | "prod";
export type EnvironmentStatus = "healthy" | "degraded" | "down" | "deploying" | "unknown";

export interface EnvironmentInfo {
  name: EnvironmentName;
  url: string;
  healthEndpoint: string;
  status: EnvironmentStatus;
  lastDeployedAt: Date | null;
  commitSha: string | null;
  version: string | null;
}

export interface DeploymentInfo {
  id: string;
  env: EnvironmentName;
  status: string;
  url: string;
  commitSha: string;
  commitMessage: string | null;
  createdAt: Date;
  readyAt: Date | null;
}

// Dashboard types
export interface DashboardMetrics {
  activeAgents: number;
  deploymentsToday: number;
  openIssues: number;
  errorRate: number;
  totalUsers: number;
  totalCreditsUsed: number;
}

export type ServiceHealthStatus = "healthy" | "degraded" | "down" | "unconfigured";

export interface ServiceHealth {
  name: string;
  status: ServiceHealthStatus;
  latencyMs: number | null;
  message: string | null;
}

export interface DashboardHealth {
  database: ServiceHealth;
  redis: ServiceHealth;
  vercel: ServiceHealth;
  github: ServiceHealth;
}

export interface ActivityFeedItem {
  id: string;
  type: "agent" | "deployment" | "error" | "job" | "user";
  title: string;
  description: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// Roadmap types
export interface RoadmapItem {
  id: string;
  title: string;
  status: string;
  labels: string[];
  assignee: string | null;
  url: string;
  priority: string | null;
}

// Notification types
export interface SwarmNotification {
  id: string;
  type: "info" | "warning" | "error" | "success";
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

// SSE event types
export type SSEEventType =
  | "agent_heartbeat"
  | "agent_message"
  | "error_alert"
  | "deployment_status"
  | "job_status"
  | "swarm_topology_change"
  | "keepalive";

export interface SSEEvent {
  id: string;
  type: SSEEventType;
  data: unknown;
  timestamp: number;
}

// Widget types
export type WidgetId = "metrics" | "environments" | "agents" | "alerts" | "deployments";

export interface WidgetConfig {
  id: WidgetId;
  title: string;
  refreshInterval: number;
  enabled: boolean;
}

// Chat types
export type ChatMessageRole = "user" | "assistant" | "system";

export interface AgentChatMessage {
  id: string;
  agentId: string;
  role: ChatMessageRole;
  content: string;
  timestamp: Date;
}

// Environment metrics types
export interface EnvironmentMetricsData {
  requestsPerMinute: number;
  avgResponseMs: number;
  errorCount: number;
  uptimePercent: number;
}

// Analytics types
export interface AnalyticsData {
  period: {
    start: Date;
    end: Date;
  };
  userGrowth: Array<{ date: string; count: number }>;
  mcpUsage: Array<{ tool: string; count: number }>;
  errorRate: Array<{ date: string; rate: number }>;
}
