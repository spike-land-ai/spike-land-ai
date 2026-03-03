"use client";

import { McpConfigSnippet } from "@/components/mcp/McpConfigSnippet";
import { Link } from "@/components/ui/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Code, ExternalLink, Globe, Settings, Terminal } from "lucide-react";

const claudeDesktopConfig = `{
  "mcpServers": {
    "spike-land": {
      "url": "https://spike.land/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}`;

const claudeCodeConfig = `# Recommended: Device authorization (no API key needed)
# 1. Register a client, then request a device code:
curl -X POST https://spike.land/api/mcp/oauth/device \\
  -d 'client_id=YOUR_CLIENT_ID'
# 2. Open the verification URL in your browser and approve
# 3. Poll for the token, then configure Claude Code:

claude mcp add --transport http \\
  --header "Authorization: Bearer YOUR_MCP_TOKEN" \\
  spike-land https://spike.land/api/mcp`;

const cursorConfig = `{
  "mcpServers": {
    "spike-land": {
      "url": "https://spike.land/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}`;

const httpConfig = `curl -X POST https://spike.land/api/mcp \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'`;

export function McpIntegrationGuide() {
  return (
    <section className="container mx-auto px-4 py-24 sm:py-32 border-t border-white/[0.05] relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-950/5 to-transparent pointer-events-none" />

      <div className="relative text-center space-y-4 mb-12">
        <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white">
          Get Connected
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Integrate spike.land MCP with your favorite AI tools in seconds.
        </p>
      </div>

      <Tabs
        defaultValue="claude-desktop"
        className="max-w-3xl mx-auto relative z-10"
      >
        <div className="flex justify-center mb-8 overflow-x-auto pb-2 sm:pb-0">
          <TabsList className="bg-black/20 backdrop-blur-xl border border-white/10 p-1.5 h-auto rounded-full inline-flex gap-1 [&_.glass-edge]:hidden">
            <TabsTrigger
              value="claude-desktop"
              className="rounded-full px-4 py-2 text-sm data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400 transition-all duration-300 gap-2"
            >
              <Settings className="w-4 h-4" />
              Claude Desktop
            </TabsTrigger>
            <TabsTrigger
              value="claude-code"
              className="rounded-full px-4 py-2 text-sm data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400 transition-all duration-300 gap-2"
            >
              <Terminal className="w-4 h-4" />
              Claude Code
            </TabsTrigger>
            <TabsTrigger
              value="cursor"
              className="rounded-full px-4 py-2 text-sm data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400 transition-all duration-300 gap-2"
            >
              <Code className="w-4 h-4" />
              Cursor
            </TabsTrigger>
            <TabsTrigger
              value="http"
              className="rounded-full px-4 py-2 text-sm data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400 transition-all duration-300 gap-2"
            >
              <Globe className="w-4 h-4" />
              HTTP
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="relative group perspective-1000">
          <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-pink-500/20 rounded-2xl blur opacity-20 group-hover:opacity-40 transition-opacity duration-500" />

          <TabsContent
            value="claude-desktop"
            className="mt-0 relative animate-in fade-in zoom-in-95 duration-300"
          >
            <McpConfigSnippet code={claudeDesktopConfig} language="json" />
          </TabsContent>

          <TabsContent
            value="claude-code"
            className="mt-0 relative animate-in fade-in zoom-in-95 duration-300"
          >
            <McpConfigSnippet code={claudeCodeConfig} language="bash" />
          </TabsContent>

          <TabsContent
            value="cursor"
            className="mt-0 relative animate-in fade-in zoom-in-95 duration-300"
          >
            <McpConfigSnippet code={cursorConfig} language="json" />
          </TabsContent>

          <TabsContent
            value="http"
            className="mt-0 relative animate-in fade-in zoom-in-95 duration-300"
          >
            <McpConfigSnippet code={httpConfig} language="bash" />
          </TabsContent>
        </div>
      </Tabs>

      <div className="text-center mt-12 relative z-10">
        <Link
          href="/settings?tab=api-keys"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-white transition-colors group px-4 py-2 rounded-full hover:bg-white/5 border border-transparent hover:border-white/10"
        >
          <span>Need an API key?</span>
          <span className="text-cyan-400 group-hover:underline flex items-center gap-1">
            Go to Settings <ExternalLink className="h-3 w-3" />
          </span>
        </Link>
      </div>
    </section>
  );
}
