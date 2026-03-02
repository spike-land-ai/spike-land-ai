"use client";

import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Accessibility, Loader2 } from "lucide-react";
import { qaAccessibility } from "@/lib/qa-studio/actions";
import { isActionError, type QaAccessibilityResult } from "@/lib/qa-studio/types";

type PanelStatus = "idle" | "loading" | "success" | "error";

interface Violation {
  issue: string;
  impact: string;
}

function getScoreVariant(score: number): "success" | "warning" | "destructive" {
  if (score >= 80) return "success";
  if (score >= 60) return "warning";
  return "destructive";
}

function getImpactBadgeVariant(impact: string): "destructive" | "warning" | "default" | "outline" {
  switch (impact.toLowerCase()) {
    case "critical":
      return "destructive";
    case "serious":
      return "warning";
    case "moderate":
      return "warning";
    case "minor":
      return "default";
    default:
      return "outline";
  }
}

function getImpactColor(impact: string): string {
  switch (impact.toLowerCase()) {
    case "critical":
      return "border-red-500/30 bg-red-500/5";
    case "serious":
      return "border-orange-500/30 bg-orange-500/5";
    case "moderate":
      return "border-amber-500/30 bg-amber-500/5";
    case "minor":
      return "border-blue-500/30 bg-blue-500/5";
    default:
      return "border-border/30 bg-white/5";
  }
}

export function AccessibilityPanel() {
  const [status, setStatus] = useState<PanelStatus>("idle");
  const [result, setResult] = useState<QaAccessibilityResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScan = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const data = await qaAccessibility();
      if (isActionError(data)) {
        setError(data.error);
        setStatus("error");
        return;
      }
      setResult(data);
      setStatus("success");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Accessibility scan failed";
      setError(message);
      setStatus("error");
    }
  }, []);

  const scoreVariant = result ? getScoreVariant(result.score) : "success";

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/40">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Accessibility className="h-4 w-4 text-primary" />
            Accessibility
          </CardTitle>
          <Button size="sm" onClick={handleScan} disabled={status === "loading"} className="h-7">
            {status === "loading" ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : null}
            Scan
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {status === "error" && error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive mb-2">
            {error}
          </div>
        )}

        {status === "loading" && (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}

        {status === "success" && result && (
          <div className="space-y-4">
            {/* Score display */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Score ({result.standard})</span>
                <span className="text-lg font-bold tabular-nums">
                  {result.score}
                  <span className="text-xs text-muted-foreground font-normal">/100</span>
                </span>
              </div>
              <Progress value={result.score} variant={scoreVariant} glow className="h-2.5" />
            </div>

            {/* Violations list */}
            {result.violations.length === 0 ? (
              <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3 text-xs text-green-400 text-center">
                No accessibility violations found
              </div>
            ) : (
              <ScrollArea className="h-[180px]">
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {result.violations.length} violation{result.violations.length !== 1 ? "s" : ""}{" "}
                    found
                  </p>
                  {result.violations.map((violation: Violation, idx: number) => (
                    <div
                      key={`${violation.impact}-${idx}`}
                      className={`rounded-lg border p-3 ${getImpactColor(violation.impact)}`}
                    >
                      <div className="flex items-start gap-2">
                        <Badge
                          variant={getImpactBadgeVariant(violation.impact)}
                          className="text-[10px] px-1.5 py-0 shrink-0 mt-0.5"
                        >
                          {violation.impact}
                        </Badge>
                        <span className="text-xs text-foreground/80">{violation.issue}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        )}

        {status === "idle" && (
          <div className="flex items-center justify-center h-24 rounded-lg border border-dashed border-border/30 text-muted-foreground text-xs">
            Click Scan to run accessibility audit
          </div>
        )}
      </CardContent>
    </Card>
  );
}
