"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/components/ui/link";
import type { DocsTool } from "@/lib/docs/types";
import { truncate } from "@/lib/utils";

function formatToolName(name: string): string {
  return name.replace(/_/g, " ");
}

interface ToolCardProps {
  tool: DocsTool;
}

export function ToolCard({ tool }: ToolCardProps) {
  const displayName = formatToolName(tool.name);
  const shortDesc = truncate(tool.description.split("\n")[0] || "", 120);

  return (
    <Link href={`/docs/tools/${tool.category}/${tool.name}`} className="group block no-underline">
      <Card className="h-full bg-white/5 border border-white/10 hover:border-primary/40 hover:shadow-[0_0_20px_rgba(var(--primary-rgb,59,130,246),0.15)] transition-all duration-300">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold leading-snug">{displayName}</CardTitle>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">
              {tool.category}
            </Badge>
            <Badge
              variant={tool.tier === "free" ? "success" : "secondary"}
              className="text-[10px] px-1.5 py-0.5"
            >
              {tool.tier}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground leading-relaxed">{shortDesc}</p>
          {tool.parameters.length > 0 && (
            <p className="text-xs text-muted-foreground/60">
              {tool.parameters.length} parameter{tool.parameters.length !== 1 ? "s" : ""}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
