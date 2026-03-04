import { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useMcpTools, useMcpToolCall } from "../../src/hooks/useMcp";
import { JsonSchemaForm } from "../../src/components/tools/JsonSchemaForm";

export function ToolsCategoryPage() {
  const { toolName } = useParams({ strict: false }) as { toolName: string };
  const { data: toolsData, isLoading: toolsLoading } = useMcpTools();
  const executeTool = useMcpToolCall();
  
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [result, setResult] = useState<any>(null);

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
        <div className="text-gray-500">Loading tool schema...</div>
      </div>
    );
  }

  if (!tool) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center text-red-600">
        <h2 className="text-lg font-bold">Tool Not Found</h2>
        <p className="mt-2">The tool "{toolName}" does not exist in the current MCP registry.</p>
        <Link to="/tools" className="mt-4 inline-block text-red-700 hover:underline">
          &larr; Back to Tools
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/tools" className="text-cyan-600 hover:underline dark:text-cyan-400">
          Tools
        </Link>
        <span className="text-gray-400">/</span>
        <h1 className="text-2xl font-bold font-mono text-gray-900 dark:text-white">{tool.name}</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input Form Column */}
        <div className="space-y-6">
          <div className="rounded-xl border bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
            <h2 className="text-lg font-semibold mb-2 dark:text-white">Description</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">{tool.description}</p>
            
            <h2 className="text-lg font-semibold mb-4 dark:text-white">Arguments</h2>
            <JsonSchemaForm
              schema={tool.inputSchema as any}
              onChange={setFormData}
              onSubmit={handleExecute}
              isPending={executeTool.isPending}
            />
          </div>

          <div className="rounded-xl border bg-gray-50 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/30">
             <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Generated Payload</h3>
             <pre className="overflow-x-auto text-xs text-gray-700 dark:text-gray-300">
               {JSON.stringify({ name: toolName, arguments: formData }, null, 2)}
             </pre>
          </div>
        </div>

        {/* Execution Result Column */}
        <div className="rounded-xl border bg-white shadow-sm flex flex-col overflow-hidden dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="border-b bg-gray-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-semibold dark:text-white">Execution Result</h2>
          </div>
          <div className="flex-1 bg-gray-900 p-4 text-sm text-green-400 overflow-x-auto font-mono">
            {!result && !executeTool.isPending && (
              <span className="text-gray-500">Waiting for execution...</span>
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
