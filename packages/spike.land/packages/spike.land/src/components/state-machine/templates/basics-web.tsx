/**
 * State Machine Templates: Basics & Web & API
 */

import {
  Globe,
  Lock,
  Radio,
  RefreshCw,
  ShieldCheck,
  Timer,
  TrafficCone,
  Zap,
} from "lucide-react";
import type { TemplateDefinition } from "../TemplateLibrary";

export const BASICS_TEMPLATES: TemplateDefinition[] = [
  {
    name: "Traffic Light",
    description: "3 states cycling with NEXT event",
    icon: <TrafficCone className="w-5 h-5" />,
    color: "#ef4444",
    category: "Basics",
    initialState: "red",
    states: [
      { id: "red", type: "atomic" },
      { id: "green", type: "atomic" },
      { id: "yellow", type: "atomic" },
    ],
    transitions: [
      { source: "red", target: "green", event: "NEXT" },
      { source: "green", target: "yellow", event: "NEXT" },
      { source: "yellow", target: "red", event: "NEXT" },
    ],
  },
  {
    name: "Toggle Switch",
    description: "Simple on/off toggle",
    icon: <Zap className="w-5 h-5" />,
    color: "#eab308",
    category: "Basics",
    initialState: "off",
    states: [
      { id: "off", type: "atomic" },
      { id: "on", type: "atomic" },
    ],
    transitions: [
      { source: "off", target: "on", event: "TOGGLE" },
      { source: "on", target: "off", event: "TOGGLE" },
    ],
  },
  {
    name: "Countdown Timer",
    description: "Timer with start, tick, and alarm",
    icon: <Timer className="w-5 h-5" />,
    color: "#f97316",
    category: "Basics",
    initialState: "idle",
    states: [
      { id: "idle", type: "atomic" },
      { id: "running", type: "atomic" },
      { id: "paused", type: "atomic" },
      { id: "alarm", type: "atomic" },
    ],
    transitions: [
      { source: "idle", target: "running", event: "START" },
      { source: "running", target: "paused", event: "PAUSE" },
      { source: "paused", target: "running", event: "RESUME" },
      { source: "running", target: "alarm", event: "TIMEOUT" },
      { source: "alarm", target: "idle", event: "RESET" },
      { source: "paused", target: "idle", event: "RESET" },
    ],
    context: { remaining: 60 },
  },
  {
    name: "Door Lock",
    description: "Locked \u2192 unlocked \u2192 open \u2192 closed cycle",
    icon: <Lock className="w-5 h-5" />,
    color: "#64748b",
    category: "Basics",
    initialState: "locked",
    states: [
      { id: "locked", type: "atomic" },
      { id: "unlocked", type: "atomic" },
      { id: "open", type: "atomic" },
    ],
    transitions: [
      { source: "locked", target: "unlocked", event: "UNLOCK" },
      { source: "unlocked", target: "locked", event: "LOCK" },
      { source: "unlocked", target: "open", event: "OPEN" },
      { source: "open", target: "unlocked", event: "CLOSE" },
    ],
  },
];

export const WEB_API_TEMPLATES: TemplateDefinition[] = [
  {
    name: "HTTP Request",
    description: "idle \u2192 loading \u2192 success/error with FETCH event",
    icon: <Globe className="w-5 h-5" />,
    color: "#3b82f6",
    category: "Web & API",
    initialState: "idle",
    states: [
      { id: "idle", type: "atomic" },
      { id: "loading", type: "atomic" },
      { id: "success", type: "atomic" },
      { id: "error", type: "atomic" },
    ],
    transitions: [
      { source: "idle", target: "loading", event: "FETCH" },
      { source: "loading", target: "success", event: "SUCCESS" },
      { source: "loading", target: "error", event: "ERROR" },
      { source: "success", target: "idle", event: "RESET" },
      { source: "error", target: "loading", event: "RETRY" },
      { source: "error", target: "idle", event: "RESET" },
    ],
    context: { retryCount: 0, data: null, errorMessage: "" },
  },
  {
    name: "Auth Flow",
    description: "Login flow with guards and token expiry",
    icon: <ShieldCheck className="w-5 h-5" />,
    color: "#22c55e",
    category: "Web & API",
    initialState: "logged_out",
    states: [
      { id: "logged_out", type: "atomic" },
      { id: "authenticating", type: "atomic" },
      { id: "logged_in", type: "atomic" },
      { id: "expired", type: "atomic" },
    ],
    transitions: [
      { source: "logged_out", target: "authenticating", event: "LOGIN" },
      { source: "authenticating", target: "logged_in", event: "AUTH_SUCCESS" },
      {
        source: "authenticating",
        target: "logged_out",
        event: "AUTH_FAILURE",
        actions: [{
          type: "assign",
          params: { error: "Authentication failed" },
        }],
      },
      { source: "logged_in", target: "expired", event: "TOKEN_EXPIRED" },
      { source: "expired", target: "authenticating", event: "REFRESH" },
      {
        source: "logged_in",
        target: "logged_out",
        event: "LOGOUT",
        actions: [{ type: "assign", params: { token: null } }],
      },
      { source: "expired", target: "logged_out", event: "LOGOUT" },
    ],
    context: { token: null, error: null, user: null },
  },
  {
    name: "Retry with Backoff",
    description: "Exponential retry pattern with max attempts",
    icon: <RefreshCw className="w-5 h-5" />,
    color: "#06b6d4",
    category: "Web & API",
    initialState: "idle",
    states: [
      { id: "idle", type: "atomic" },
      { id: "attempting", type: "atomic" },
      { id: "waiting", type: "atomic" },
      { id: "success", type: "final" },
      { id: "failed", type: "final" },
    ],
    transitions: [
      { source: "idle", target: "attempting", event: "START" },
      { source: "attempting", target: "success", event: "SUCCESS" },
      {
        source: "attempting",
        target: "waiting",
        event: "FAILURE",
        guard_expression: "context.retryCount < 3",
        actions: [{
          type: "assign",
          params: { retryCount: "context.retryCount + 1" },
        }],
      },
      {
        source: "attempting",
        target: "failed",
        event: "FAILURE",
        guard_expression: "context.retryCount >= 3",
      },
      {
        source: "waiting",
        target: "attempting",
        event: "RETRY",
        delay_expression: "1000 * (2 ** (context.retryCount - 1))",
      },
    ],
    context: { retryCount: 0, maxRetries: 3, lastError: null },
  },
  {
    name: "WebSocket Connection",
    description: "Connect, disconnect, reconnect lifecycle",
    icon: <Radio className="w-5 h-5" />,
    color: "#a855f7",
    category: "Web & API",
    initialState: "disconnected",
    states: [
      { id: "disconnected", type: "atomic" },
      { id: "connecting", type: "atomic" },
      { id: "connected", type: "atomic" },
      { id: "reconnecting", type: "atomic" },
    ],
    transitions: [
      { source: "disconnected", target: "connecting", event: "CONNECT" },
      { source: "connecting", target: "connected", event: "OPEN" },
      { source: "connecting", target: "disconnected", event: "ERROR" },
      { source: "connected", target: "disconnected", event: "CLOSE" },
      { source: "connected", target: "reconnecting", event: "ERROR" },
      { source: "reconnecting", target: "connected", event: "OPEN" },
      { source: "reconnecting", target: "disconnected", event: "MAX_RETRIES" },
    ],
    context: { retryCount: 0, url: "" },
  },
];
