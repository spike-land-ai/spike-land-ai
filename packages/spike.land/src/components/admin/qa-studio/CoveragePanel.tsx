"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { BarChart3, ChevronDown, ChevronRight, Loader2, Play } from "lucide-react";
import { qaCoverage } from "@/lib/qa-studio/actions";
import { type QaCoverageResult } from "@/lib/qa-studio/types";

type PanelStatus = "idle" | "loading" | "success" | "error";

function getCoverageVariant(value: number | undefined): "success" | "warning" | "destructive" {
  if (value === undefined) return "destructive";
  if (value >= 80) return "success";
  if (value >= 60) return "warning";
  return "destructive";
}

interface CoverageBarProps {
  label: string;
  value: number | undefined;
}

function CoverageBar({ label, value }: CoverageBarProps) {
  const displayValue = value ?? 0;
  const variant = getCoverageVariant(value);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-medium tabular-nums">
          {value !== undefined ? `${value.toFixed(1)}%` : "N/A"}
        </span>
      </div>
      <Progress value={displayValue} variant={variant} glow className="h-2" />
    </div>
  );
}

export function CoveragePanel() {
  const [status, setStatus] = useState<PanelStatus>("idle");
  const [target, setTarget] = useState("");
  const [result, setResult] = useState<QaCoverageResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rawOpen, setRawOpen] = useState(false);

  const handleRun = useCallback(async () => {
    if (!target.trim()) return;
    setStatus("loading");
    setError(null);
    setRawOpen(false);
    try {
      const data = await qaCoverage(target);
      setResult(data);
      setStatus("success");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Coverage analysis failed";
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
            <BarChart3 className="h-4 w-4 text-primary" />
            Coverage
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="src/lib/utils.ts"
            className="text-xs font-mono h-8 bg-black/20 border-border/30 flex-1"
            aria-label="Source file path for coverage"
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
            Analyze
          </Button>
        </div>

        {status === "loading" && (
          <div className="space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        )}

        {status === "error" && error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            {error}
          </div>
        )}

        {status === "success" && result && (
          <div className="space-y-4">
            <div className="text-xs text-muted-foreground">
              Target: <span className="font-mono text-foreground/80">{result.target}</span>
            </div>

            {/* Coverage bars */}
            <div className="space-y-3">
              <CoverageBar label="Lines" value={result.lines} />
              <CoverageBar label="Functions" value={result.functions} />
              <CoverageBar label="Branches" value={result.branches} />
              <CoverageBar label="Statements" value={result.statements} />
            </div>

            {/* Raw output collapsible */}
            <Collapsible open={rawOpen} onOpenChange={setRawOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-full justify-start text-xs text-muted-foreground hover:text-foreground"
                >
                  {rawOpen ? (
                    <ChevronDown className="h-3 w-3 mr-1.5" />
                  ) : (
                    <ChevronRight className="h-3 w-3 mr-1.5" />
                  )}
                  Raw output
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <pre className="mt-2 rounded-lg border border-border/30 bg-black/20 p-3 text-xs font-mono text-foreground/60 whitespace-pre-wrap break-all max-h-[200px] overflow-y-auto">
                  {result.raw}
                </pre>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}

        {status === "idle" && (
          <div className="flex items-center justify-center h-24 rounded-lg border border-dashed border-border/30 text-muted-foreground text-xs">
            Enter a source file path to analyze coverage
          </div>
        )}
      </CardContent>
    </Card>
  );
}
