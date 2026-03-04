import { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useMcpTools, useMcpToolCall } from "../../src/hooks/useMcp";
import { JsonSchemaForm } from "../../src/components/tools/JsonSchemaForm";

export function ToolsCategoryPage() {
  const { toolName } = useParams({ strict: false }) as { toolName: string };
  const { data: toolsData, isLoading: toolsLoading } = useMcpTools();
  const executeTool = useMcpToolCall();

  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [result, setResult] = useState<{ success: true; data: unknown } | { success: false; error: string } | null>(null);

  const tool = toolsData?.tools?.find((t) => t.name === toolName);

  const handleExecute = () => {
    executeTool.mutate(
      { name: toolName, args: formData },
      {
        onSuccess: (data) => setResult({ success: true, data }),
        onError: (error) => setResult({ success: false, error: error.message }),
      }
    );
  };

  if (toolsLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-muted-foreground animate-pulse">Loading tool schema...</div>
      </div>
    );
  }

  if (!tool) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-8 text-center text-destructive">
        <h2 className="text-lg font-bold">Tool Not Found</h2>
        <p className="mt-2">The tool "{toolName}" does not exist in the current MCP registry.</p>
        <Link to="/tools" className="mt-4 inline-block text-destructive hover:underline">
          &larr; Back to Tools
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/tools" className="text-primary hover:underline">
          Tools
        </Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-2xl font-bold font-mono text-foreground">{tool.name}</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input Form Column */}
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-2 text-foreground">Description</h2>
            <p className="text-muted-foreground text-sm mb-6">{tool.description}</p>

            <h2 className="text-lg font-semibold mb-4 text-foreground">Arguments</h2>
            <JsonSchemaForm
              schema={tool.inputSchema as Parameters<typeof JsonSchemaForm>[0]["schema"]}
              onChange={setFormData}
              onSubmit={handleExecute}
              isPending={executeTool.isPending}
            />
          </div>

          <div className="rounded-xl border border-border bg-muted p-4 shadow-sm">
             <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Generated Payload</h3>
             <pre className="overflow-x-auto text-xs text-foreground">
               {JSON.stringify({ name: toolName, arguments: formData }, null, 2)}
             </pre>
          </div>
        </div>

        {/* Execution Result Column */}
        <div className="rounded-xl border border-border bg-card shadow-sm flex flex-col overflow-hidden">
          <div className="border-b border-border bg-muted px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Execution Result</h2>
          </div>
          <div className="flex-1 bg-foreground p-4 text-sm text-success-foreground overflow-x-auto font-mono">
            {!result && !executeTool.isPending && (
              <span className="text-muted-foreground">Waiting for execution...</span>
            )}

            {executeTool.isPending && (
              <span className="text-cyan-400 animate-pulse">Running tool...</span>
            )}

            {result?.success && (
              <pre className="whitespace-pre-wrap break-words">
                {JSON.stringify(result.data, null, 2)}
              </pre>
            )}

            {result?.success === false && (
              <span className="text-red-400">Error: {result.error}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
