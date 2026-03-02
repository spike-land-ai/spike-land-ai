const fs = require('fs');

let content = fs.readFileSync('packages/spacetimedb-platform/module/src/lib.ts', 'utf8');

// Fix microsSinceEpoch
content = content.replace(/microsSinceEpoch/g, 'microsSinceUnixEpoch');

// Fix schema object
content = content.replace(
  `const spacetimedb = schema(
  User,
  OAuthLink,
  RegisteredTool,
  ToolUsage,
  UserToolPreference,
  App,
  AppVersion,
  AppMessage,
  Agent,
  AgentMessage,
  McpTask,
  Page,
  PageBlock,
  DirectMessage,
  PlatformEvent,
  HealthCheck,
);`,
  `const spacetimedb = schema({
  user: User,
  oauth_link: OAuthLink,
  registered_tool: RegisteredTool,
  tool_usage: ToolUsage,
  user_tool_preference: UserToolPreference,
  app: App,
  app_version: AppVersion,
  app_message: AppMessage,
  agent: Agent,
  agent_message: AgentMessage,
  mcp_task: McpTask,
  page: Page,
  page_block: PageBlock,
  direct_message: DirectMessage,
  platform_event: PlatformEvent,
  health_check: HealthCheck,
});`
);

// Fix init, clientConnected, clientDisconnected
content = content.replace(
  `spacetimedb.init(`,
  `export const init = spacetimedb.init(`
);
content = content.replace(
  `spacetimedb.clientConnected(`,
  `export const onConnect = spacetimedb.clientConnected(`
);
content = content.replace(
  `spacetimedb.clientDisconnected(`,
  `export const onDisconnect = spacetimedb.clientDisconnected(`
);

// Fix reducers
// We need to match spacetimedb.reducer("name", { ... }, (ctx, ...) => { ... })
// and replace with export const name = spacetimedb.reducer({ ... }, (ctx, ...) => { ... })
// But wait, some have empty params: spacetimedb.reducer("unregister_agent", {}, (ctx) => ...)
// Wait, the API for empty params is just spacetimedb.reducer((ctx) => ...) or spacetimedb.reducer({}, (ctx) => ...) ?
// Let's replace `spacetimedb.reducer("name", ` with `export const name = spacetimedb.reducer(`

const regex = /spacetimedb\.reducer\(\s*"([a-zA-Z0-9_]+)",\s*/g;
content = content.replace(regex, (match, name) => {
  return `export const ${name} = spacetimedb.reducer(\n  `;
});

// One exception is `spacetimedb.reducer("unregister_agent", {}, (ctx) => {`
// If it has {}, we just leave it as is or change it to spacetimedb.reducer((ctx) => { ... })?
// Looking at schema.d.ts: reducer(fn: Reducer<S, {}>) is allowed, and reducer(params: Params, fn) is allowed.
// If it's `export const unregister_agent = spacetimedb.reducer({}, (ctx) => {`, it's valid.

fs.writeFileSync('packages/spacetimedb-platform/module/src/lib.ts', content);
console.log('Fixed lib.ts');
