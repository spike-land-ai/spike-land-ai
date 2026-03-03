"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Code, Loader2, Play } from "lucide-react";
import { qaEvaluate } from "@/lib/qa-studio/actions";
import { isActionError, type QaEvaluateResult } from "@/lib/qa-studio/types";

type PanelStatus = "idle" | "loading" | "success" | "error";

export function EvaluatePanel() {
  const [status, setStatus] = useState<PanelStatus>("idle");
  const [expression, setExpression] = useState("");
  const [result, setResult] = useState<QaEvaluateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRun = useCallback(async () => {
    if (!expression.trim()) return;
    setStatus("loading");
    setError(null);
    try {
      const data = await qaEvaluate(expression);
      if (isActionError(data)) {
        setError(data.error);
        setStatus("error");
        return;
      }
      setResult(data);
      setStatus("success");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Evaluation failed";
      setError(message);
      setStatus("error");
    }
  }, [expression]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleRun();
      }
    },
    [handleRun],
  );

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/40">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Code className="h-4 w-4 text-primary" />
            Evaluate
          </CardTitle>
          <Button
            size="sm"
            onClick={handleRun}
            disabled={status === "loading" || !expression.trim()}
            className="h-7"
          >
            {status === "loading"
              ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
              : <Play className="h-3 w-3 mr-1.5" />}
            Run
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={expression}
          onChange={e => setExpression(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="document.title"
          className="font-mono text-xs min-h-[80px] resize-y bg-black/20 border-border/30"
          aria-label="JavaScript expression"
        />
        <p className="text-[10px] text-muted-foreground/60">
          Press Cmd+Enter or Ctrl+Enter to run
        </p>

        {status === "loading" && <Skeleton className="h-16 w-full" />}

        {status === "error" && error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive font-mono">
            {error}
          </div>
        )}

        {status === "success" && result && (
          <div className="space-y-1">
            <span className="text-[10px] text-muted-foreground">Result:</span>
            <pre className="rounded-lg border border-border/30 bg-black/20 p-3 text-xs font-mono text-foreground/80 overflow-x-auto whitespace-pre-wrap break-all max-h-[200px] overflow-y-auto">
              {result.output}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
