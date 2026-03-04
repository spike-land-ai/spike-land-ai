/**
 * WhatsApp command parser and dispatcher.
 * Parses incoming messages into structured commands and dispatches them.
 */

import type { Env } from "../env.js";

export type Tier = "free" | "pro" | "elite";

export interface CommandContext {
  db: D1Database;
  userId: string;
  tier: Tier;
  env: Env;
  phoneHash: string;
}

export type CommandName =
  | "help"
  | "bug"
  | "bugs"
  | "tools"
  | "use"
  | "key"
  | "subscribe"
  | "status"
  | "chat";

export interface ParsedCommand {
  name: CommandName;
  args: string;
  raw: string;
}

const COMMAND_PATTERN = /^\/(\w+)\s*(.*)/s;

export function parseCommand(message: string): ParsedCommand {
  const trimmed = message.trim();
  const match = trimmed.match(COMMAND_PATTERN);

  if (!match) {
    return { name: "chat", args: trimmed, raw: trimmed };
  }

  const name = (match[1] ?? "").toLowerCase();
  const args = (match[2] ?? "").trim();

  const validCommands: CommandName[] = [
    "help", "bug", "bugs", "tools", "use", "key", "subscribe", "status",
  ];

  if (validCommands.includes(name as CommandName)) {
    return { name: name as CommandName, args, raw: trimmed };
  }

  // Unknown slash command — treat as chat
  return { name: "chat", args: trimmed, raw: trimmed };
}

const HELP_TEXT = `Available commands:
/help — Show this help message
/bug <title> | <description> — Submit a bug report
/bugs — List your bug reports
/tools [query] — Search available MCP tools
/use <tool> [args as JSON] — Execute an MCP tool
/key set <provider> <key> — Store a BYOK API key
/subscribe — Get subscription upgrade link
/status — Show your plan, ELO, and active grants

Or just type a message to chat with AI (pro+ only).`;

export async function dispatchCommand(
  cmd: ParsedCommand,
  ctx: CommandContext,
): Promise<string> {
  switch (cmd.name) {
    case "help":
      return HELP_TEXT;

    case "bug":
      return handleBug(cmd.args, ctx);

    case "bugs":
      return handleBugs(ctx);

    case "tools":
      return handleTools(cmd.args, ctx);

    case "use":
      return handleUse(cmd.args, ctx);

    case "key":
      return handleKey(cmd.args, ctx);

    case "subscribe":
      return handleSubscribe(ctx);

    case "status":
      return handleStatus(ctx);

    case "chat":
      return handleChat(cmd.args, ctx);

    default:
      return HELP_TEXT;
  }
}

async function handleBug(args: string, ctx: CommandContext): Promise<string> {
  const parts = args.split("|").map((s) => s.trim());
  const title = parts[0];
  const description = parts[1] ?? "";

  if (!title) {
    return "Usage: /bug <title> | <description>";
  }

  const rpcBody = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "submit_bug_report",
      arguments: { title, description, reporter_id: ctx.userId },
    },
  });

  const resp = await ctx.env.MCP_SERVICE.fetch(
    new Request("https://mcp.spike.land/rpc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: rpcBody,
    }),
  );

  if (!resp.ok) {
    return "Failed to submit bug report. Please try again later.";
  }

  return `Bug report submitted: "${title}"`;
}

async function handleBugs(ctx: CommandContext): Promise<string> {
  const rpcBody = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "list_bug_reports",
      arguments: { reporter_id: ctx.userId },
    },
  });

  const resp = await ctx.env.MCP_SERVICE.fetch(
    new Request("https://mcp.spike.land/rpc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: rpcBody,
    }),
  );

  if (!resp.ok) {
    return "Failed to fetch bug reports.";
  }

  const result = await resp.json<{ result?: { content?: Array<{ text?: string }> } }>();
  const text = result?.result?.content?.[0]?.text;
  return text ?? "No bug reports found.";
}

async function handleTools(query: string, ctx: CommandContext): Promise<string> {
  const rpcBody = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "search_tools",
      arguments: { query: query || "" },
    },
  });

  const resp = await ctx.env.MCP_SERVICE.fetch(
    new Request("https://mcp.spike.land/rpc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: rpcBody,
    }),
  );

  if (!resp.ok) {
    return "Failed to search tools.";
  }

  const result = await resp.json<{ result?: { content?: Array<{ text?: string }> } }>();
  const text = result?.result?.content?.[0]?.text;
  return text ?? "No tools found.";
}

async function handleUse(args: string, ctx: CommandContext): Promise<string> {
  if (ctx.tier === "free") {
    return "Tool execution requires a pro or elite plan. Use /subscribe to upgrade.";
  }

  const spaceIdx = args.indexOf(" ");
  const toolName = spaceIdx === -1 ? args : args.slice(0, spaceIdx);
  const toolArgsStr = spaceIdx === -1 ? "{}" : args.slice(spaceIdx + 1).trim();

  if (!toolName) {
    return "Usage: /use <tool> [args as JSON]";
  }

  let toolArgs: unknown;
  try {
    toolArgs = JSON.parse(toolArgsStr);
  } catch {
    return "Invalid JSON arguments. Usage: /use <tool> {\"key\": \"value\"}";
  }

  const rpcBody = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: toolName,
      arguments: toolArgs,
    },
  });

  const resp = await ctx.env.MCP_SERVICE.fetch(
    new Request("https://mcp.spike.land/rpc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: rpcBody,
    }),
  );

  if (!resp.ok) {
    return `Failed to execute tool "${toolName}".`;
  }

  const result = await resp.json<{ result?: { content?: Array<{ text?: string }> }; error?: { message?: string } }>();

  if (result?.error) {
    return `Error: ${result.error.message ?? "Unknown error"}`;
  }

  const text = result?.result?.content?.[0]?.text;
  return text ?? "Tool executed (no output).";
}

async function handleKey(args: string, ctx: CommandContext): Promise<string> {
  const parts = args.split(/\s+/);
  if (parts[0] !== "set" || parts.length < 3) {
    return "Usage: /key set <provider> <key>";
  }

  const provider = parts[1];
  const key = parts.slice(2).join(" ");

  const rpcBody = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "store_api_key",
      arguments: { user_id: ctx.userId, provider, api_key: key },
    },
  });

  const resp = await ctx.env.MCP_SERVICE.fetch(
    new Request("https://mcp.spike.land/rpc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: rpcBody,
    }),
  );

  if (!resp.ok) {
    return "Failed to store API key.";
  }

  return `API key for "${provider}" stored successfully.`;
}

async function handleSubscribe(ctx: CommandContext): Promise<string> {
  if (ctx.tier !== "free") {
    return `You are already on the ${ctx.tier} plan.`;
  }

  return "Upgrade your plan at https://spike.land/pricing";
}

async function handleStatus(ctx: CommandContext): Promise<string> {
  const elo = await ctx.db
    .prepare("SELECT elo, tier, event_count FROM user_elo WHERE user_id = ?")
    .bind(ctx.userId)
    .first<{ elo: number; tier: string; event_count: number }>();

  const grants = await ctx.db
    .prepare(
      "SELECT grant_type, tier, expires_at FROM access_grants WHERE user_id = ? AND expires_at > ?",
    )
    .bind(ctx.userId, Date.now())
    .all<{ grant_type: string; tier: string; expires_at: number }>();

  const lines: string[] = [
    `Plan: ${ctx.tier}`,
    `ELO: ${elo?.elo ?? 1200} (${elo?.tier ?? "free"})`,
    `Events: ${elo?.event_count ?? 0}`,
  ];

  if (grants.results && grants.results.length > 0) {
    lines.push("Active grants:");
    for (const g of grants.results) {
      const expires = new Date(g.expires_at).toISOString().split("T")[0];
      lines.push(`  - ${g.grant_type} (${g.tier}) expires ${expires}`);
    }
  }

  return lines.join("\n");
}

async function handleChat(message: string, ctx: CommandContext): Promise<string> {
  if (ctx.tier === "free") {
    return "Natural language chat requires a pro or elite plan. Use /subscribe to upgrade, or try /help for available commands.";
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${ctx.env.GEMINI_API_KEY}`;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: {
        parts: [
          {
            text: "You are a helpful assistant for spike.land. Keep responses under 4000 chars, no markdown.",
          },
        ],
      },
      contents: [{ parts: [{ text: message }] }],
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.7,
      },
    }),
  });

  if (!resp.ok) {
    return "Chat service is temporarily unavailable. Try a / command instead.";
  }

  const result = await resp.json<{
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  }>();

  return result?.candidates?.[0]?.content?.parts?.[0]?.text
    ?? "No response from chat service.";
}
