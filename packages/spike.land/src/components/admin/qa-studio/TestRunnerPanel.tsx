"use client";

import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { FlaskConical, Loader2, Play } from "lucide-react";
import { qaTestRun } from "@/lib/qa-studio/actions";
import { type QaTestResult } from "@/lib/qa-studio/types";

type PanelStatus = "idle" | "loading" | "success" | "error";

export function TestRunnerPanel() {
  const [status, setStatus] = useState<PanelStatus>("idle");
  const [target, setTarget] = useState("");
  const [result, setResult] = useState<QaTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRun = useCallback(async () => {
    if (!target.trim()) return;
    setStatus("loading");
    setError(null);
    try {
      const data = await qaTestRun(target);
      setResult(data);
      setStatus("success");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Test run failed";
      setError(message);
      setStatus("error");
    }
  }, [target]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
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
            <FlaskConical className="h-4 w-4 text-primary" />
            Test Runner
          </CardTitle>
          {status === "success" && result && (
            <Badge variant={result.passed ? "success" : "destructive"}>
              {result.passed ? "PASSED" : "FAILED"}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="src/lib/utils.test.ts"
            className="text-xs font-mono h-8 bg-black/20 border-border/30 flex-1"
            aria-label="Test file path"
          />
          <Button
            size="sm"
            onClick={handleRun}
            disabled={status === "loading" || !target.trim()}
            className="h-8 shrink-0"
          >
            {status === "loading" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <Play className="h-3.5 w-3.5 mr-1.5" />
            )}
            Run Tests
          </Button>
        </div>

        {status === "loading" && (
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}

        {status === "error" && error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            {error}
          </div>
        )}

        {status === "success" && result && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Target:</span>
              <span className="font-mono text-foreground/80">{result.target}</span>
            </div>
            <ScrollArea className="h-[300px]">
              <pre className="rounded-lg border border-border/30 bg-black/20 p-3 text-xs font-mono text-foreground/80 whitespace-pre-wrap break-all">
                {result.output}
              </pre>
            </ScrollArea>
          </div>
        )}

        {status === "idle" && (
          <div className="flex items-center justify-center h-24 rounded-lg border border-dashed border-border/30 text-muted-foreground text-xs">
            Enter a test file path and click Run Tests
          </div>
        )}
      </CardContent>
    </Card>
  );
}
