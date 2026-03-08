import { Loader2, Play, TerminalSquare } from "lucide-react";
import { ToolResultInline } from "@/ui/src/components/tools/ToolResultInline";
import { useMcpToolCall } from "@/ui/src/hooks/useMcp";
import type { ExecutableMdxCommand } from "./mcp-command-line";

export function MdxCommandCard({ command, toolName, args }: ExecutableMdxCommand) {
  const { mutate: callTool, isPending, data: result, error } = useMcpToolCall();

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b border-border bg-muted/30 px-4 py-3">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            <TerminalSquare className="h-3.5 w-3.5" />
            Executable Bash
          </div>
          <div className="font-mono text-sm text-foreground break-all">{command}</div>
        </div>

        <button
          type="button"
          onClick={() => callTool({ name: toolName, args })}
          disabled={isPending}
          className="shrink-0 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          aria-label={`Run ${toolName}`}
        >
          <span className="flex items-center gap-2">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Run
          </span>
        </button>
      </div>

      <div className="space-y-3 px-4 py-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Mapped to</span>
          <code className="rounded bg-background px-1.5 py-0.5 font-mono text-primary">{toolName}</code>
        </div>

        <pre className="overflow-x-auto rounded-lg border border-border bg-background p-3 text-xs text-foreground">
          <code>{JSON.stringify(args, null, 2)}</code>
        </pre>

        {(result || error) && <ToolResultInline result={result} error={error} />}
      </div>
    </div>
  );
}
