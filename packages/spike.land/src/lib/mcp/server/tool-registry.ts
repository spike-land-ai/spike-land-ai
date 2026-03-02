export class ToolRegistry {
  constructor(public mcpServer: any, public userId: string) {}
  register(def: any) {}
  enableAll() { return 0; }
  getToolCount() { return 0; }
  getToolDefinitions() { return []; }
  async callToolDirect(name: string, args: any) { return { content: [] }; }
}
