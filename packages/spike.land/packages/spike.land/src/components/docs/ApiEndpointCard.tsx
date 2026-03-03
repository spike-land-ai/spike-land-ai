import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/components/ui/link";
import type { DocsApiEndpoint } from "@/lib/docs/types";
import { cn } from "@/lib/utils";
import { Lock } from "lucide-react";

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  POST: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  PUT: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  PATCH: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  DELETE: "bg-red-500/15 text-red-400 border-red-500/20",
};

interface ApiEndpointCardProps {
  endpoint: DocsApiEndpoint;
}

export function ApiEndpointCard({ endpoint }: ApiEndpointCardProps) {
  const segments = endpoint.path
    .replace(/^\/api\//, "")
    .split("/")
    .filter(Boolean)
    .map(s => s.replace(/\[/g, "%5B").replace(/\]/g, "%5D"));
  const href = `/docs/api/${segments.join("/")}`;

  return (
    <Link href={href} className="group block no-underline">
      <Card className="h-full bg-white/5 border border-white/10 hover:border-primary/40 hover:shadow-[0_0_20px_rgba(var(--primary-rgb,59,130,246),0.15)] transition-all duration-300">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-mono font-semibold leading-snug truncate">
              {endpoint.path}
            </CardTitle>
            {endpoint.auth && <Lock className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {endpoint.methods.map(method => (
              <span
                key={method}
                className={cn(
                  "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase border",
                  METHOD_COLORS[method]
                    ?? "bg-white/10 text-muted-foreground border-white/10",
                )}
              >
                {method}
              </span>
            ))}
            <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">
              {endpoint.domain}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
            {endpoint.description}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
