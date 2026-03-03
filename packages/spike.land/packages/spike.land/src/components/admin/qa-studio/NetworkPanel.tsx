"use client";

import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Globe, Loader2 } from "lucide-react";
import { qaNetwork } from "@/lib/qa-studio/actions";
import {
  isActionError,
  type QaNetworkRequest,
  type QaNetworkResult,
} from "@/lib/qa-studio/types";
import { formatBytes } from "@/lib/utils";

type PanelStatus = "idle" | "loading" | "success" | "error";

function getStatusBadgeVariant(
  status: number,
): "success" | "warning" | "destructive" | "outline" {
  if (status >= 200 && status < 300) return "success";
  if (status >= 300 && status < 400) return "warning";
  if (status >= 400) return "destructive";
  return "outline";
}

function truncateUrl(url: string, maxLength: number = 50): string {
  if (url.length <= maxLength) return url;
  try {
    const parsed = new URL(url);
    const path = parsed.pathname + parsed.search;
    if (path.length > maxLength) {
      return `...${path.slice(-(maxLength - 3))}`;
    }
    return path;
  } catch {
    return `${url.slice(0, maxLength)}...`;
  }
}

function getMethodColor(method: string): string {
  switch (method.toUpperCase()) {
    case "GET":
      return "text-green-400";
    case "POST":
      return "text-blue-400";
    case "PUT":
    case "PATCH":
      return "text-amber-400";
    case "DELETE":
      return "text-red-400";
    default:
      return "text-muted-foreground";
  }
}

export function NetworkPanel() {
  const [status, setStatus] = useState<PanelStatus>("idle");
  const [network, setNetwork] = useState<QaNetworkResult | null>(null);
  const [includeStatic, setIncludeStatic] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFetch = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const result = await qaNetwork(includeStatic);
      if (isActionError(result)) {
        setError(result.error);
        setStatus("error");
        return;
      }
      setNetwork(result);
      setStatus("success");
    } catch (err: unknown) {
      const message = err instanceof Error
        ? err.message
        : "Failed to fetch network data";
      setError(message);
      setStatus("error");
    }
  }, [includeStatic]);

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/40">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            Network
          </CardTitle>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label
                htmlFor="static-toggle"
                className="text-xs text-muted-foreground whitespace-nowrap"
              >
                Include static
              </label>
              <Switch
                id="static-toggle"
                checked={includeStatic}
                onCheckedChange={setIncludeStatic}
              />
            </div>
            <Button
              size="sm"
              onClick={handleFetch}
              disabled={status === "loading"}
              className="h-7"
            >
              {status === "loading"
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : (
                  "Fetch"
                )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {status === "error" && error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive mb-2">
            {error}
          </div>
        )}

        {status === "loading" && (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
        )}

        {status === "success" && network && (
          <>
            <div className="flex items-center gap-4 mb-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Requests:</span>
                <span className="font-medium text-foreground">
                  {network.requests.length}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Total size:</span>
                <span className="font-medium text-foreground">
                  {formatBytes(network.totalSize)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Errors:</span>
                <span
                  className={`font-medium ${
                    network.errorCount > 0
                      ? "text-destructive"
                      : "text-foreground"
                  }`}
                >
                  {network.errorCount}
                </span>
              </div>
            </div>

            <div className="rounded-lg border border-border/30 overflow-hidden max-h-[240px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/30 hover:bg-transparent">
                    <TableHead className="h-7 text-xs">Method</TableHead>
                    <TableHead className="h-7 text-xs">Status</TableHead>
                    <TableHead className="h-7 text-xs">Type</TableHead>
                    <TableHead className="h-7 text-xs">Size</TableHead>
                    <TableHead className="h-7 text-xs">URL</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {network.requests.map((
                    req: QaNetworkRequest,
                    idx: number,
                  ) => (
                    <TableRow
                      key={`${req.method}-${req.url}-${idx}`}
                      className="border-border/20 hover:bg-white/5"
                    >
                      <TableCell className="py-1">
                        <span
                          className={`text-xs font-mono font-medium ${getMethodColor(req.method)}`}
                        >
                          {req.method}
                        </span>
                      </TableCell>
                      <TableCell className="py-1">
                        <Badge
                          variant={getStatusBadgeVariant(req.status)}
                          className="text-[10px] px-1.5 py-0"
                        >
                          {req.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-1 text-xs text-muted-foreground">
                        {req.resourceType}
                      </TableCell>
                      <TableCell className="py-1 text-xs text-muted-foreground font-mono">
                        {formatBytes(parseInt(req.contentLength || "0", 10))}
                      </TableCell>
                      <TableCell className="py-1">
                        <span
                          className="text-xs text-muted-foreground font-mono truncate block max-w-[200px]"
                          title={req.url}
                        >
                          {truncateUrl(req.url)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {network.requests.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center text-xs text-muted-foreground py-6"
                      >
                        No network requests recorded
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {status === "idle" && (
          <div className="flex items-center justify-center h-24 rounded-lg border border-dashed border-border/30 text-muted-foreground text-xs">
            Click Fetch to load network activity
          </div>
        )}
      </CardContent>
    </Card>
  );
}
