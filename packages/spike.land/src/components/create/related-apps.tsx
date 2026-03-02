import { cn } from "@/lib/utils";
import type { CreatedApp } from "@prisma/client";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import { LiveAppPreview } from "./live-app-preview";

interface RelatedAppsProps {
  links: string[];
  publishedApps?: CreatedApp[];
  className?: string;
}

export function RelatedApps({ links, publishedApps, className }: RelatedAppsProps) {
  const hasPublished = publishedApps && publishedApps.length > 0;
  const hasLinks = links && links.length > 0;

  if (!hasPublished && !hasLinks) return null;

  return (
    <div
      className={cn(
        "w-72 border-l bg-card h-[calc(100dvh-4rem)] overflow-y-auto hidden lg:block",
        className,
      )}
    >
      {/* AI-generated related links — primary */}
      {hasLinks && (
        <div className="p-3">
          <h3 className="font-semibold mb-3 text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="w-3 h-3" />
            Generate New
          </h3>
          <nav className="space-y-1">
            {links.map((link, i) => {
              const cleanLink = link.replace(/^(\/)?create\//, "");
              const href = `/create/${cleanLink}`;

              return (
                <Link
                  key={i}
                  href={href}
                  className="block px-3 py-2 rounded-md hover:bg-accent transition-colors text-sm"
                >
                  <div className="font-medium truncate">
                    {cleanLink.split("/").pop()?.replace(/-/g, " ")}
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>
      )}

      {/* Published apps with live previews — secondary */}
      {hasPublished && (
        <div className={cn("p-3", hasLinks && "border-t")}>
          <h3 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">
            More Apps
          </h3>
          <div className="space-y-3">
            {publishedApps.map((app) => (
              <Link
                key={app.id}
                href={`/create/${app.slug}`}
                className="block rounded-lg overflow-hidden border border-border/50 hover:border-primary/30 transition-colors"
              >
                {app.codespaceId && (
                  <div className="relative aspect-[16/10] overflow-hidden pointer-events-none">
                    <LiveAppPreview
                      codespaceId={app.codespaceId}
                      scale={0.25}
                      className="w-full h-full"
                      fallbackTitle={app.title}
                    />
                  </div>
                )}
                <div className="p-2">
                  <div className="font-medium text-sm truncate">{app.title}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="p-3 border-t">
        <p className="text-xs text-muted-foreground">
          Try typing any path in the URL to generate a new app!
        </p>
      </div>
    </div>
  );
}
