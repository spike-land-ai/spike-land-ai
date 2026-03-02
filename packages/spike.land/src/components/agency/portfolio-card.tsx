import type { AgencyPortfolioItem } from "@/generated/prisma";
import { cn } from "@/lib/utils";
import { ExternalLink, Github, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface PortfolioCardProps {
  item: AgencyPortfolioItem;
  className?: string;
}

const categoryLabels = {
  AI_INTEGRATION: "AI Integration",
  WEB_APP: "Web App",
  MOBILE_APP: "Mobile App",
  PROTOTYPE: "Rapid Prototype",
  OPEN_SOURCE: "Open Source",
} as const;

const categoryColors = {
  AI_INTEGRATION: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  WEB_APP: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  MOBILE_APP: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  PROTOTYPE: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  OPEN_SOURCE: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
} as const;

export function PortfolioCard({ item, className }: PortfolioCardProps) {
  const hasScreenshot = item.screenshots.length > 0;

  return (
    <div
      className={cn(
        "group relative rounded-xl border bg-card overflow-hidden transition-all duration-300",
        "hover:shadow-lg hover:border-primary/20 hover:-translate-y-1",
        className,
      )}
    >
      {/* Featured badge */}
      {item.featured && (
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300 text-xs font-medium">
          <Star className="w-3 h-3" />
          Featured
        </div>
      )}

      {/* Screenshot/Thumbnail */}
      <div className="relative aspect-video bg-muted overflow-hidden">
        {hasScreenshot && item.screenshots[0] ? (
          <Image
            src={item.screenshots[0]}
            alt={item.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <div className="text-4xl font-bold opacity-20">{item.name[0]}</div>
              <div className="text-xs mt-1">No preview</div>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Category badge */}
        <div className="mb-3">
          <span
            className={cn(
              "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
              categoryColors[item.category] ?? categoryColors.WEB_APP,
            )}
          >
            {categoryLabels[item.category] ?? item.category}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">
          {item.name}
        </h3>

        {/* Description */}
        <p className="text-sm text-muted-foreground line-clamp-3 mb-4">{item.description}</p>

        {/* Technologies */}
        {item.technologies.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {item.technologies.slice(0, 4).map((tech) => (
              <span
                key={tech}
                className="px-2 py-0.5 text-xs rounded bg-muted text-muted-foreground"
              >
                {tech}
              </span>
            ))}
            {item.technologies.length > 4 && (
              <span className="px-2 py-0.5 text-xs rounded bg-muted text-muted-foreground">
                +{item.technologies.length - 4}
              </span>
            )}
          </div>
        )}

        {/* Links */}
        <div className="flex items-center gap-3 pt-3 border-t">
          {item.url && (
            <Link
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ExternalLink className="w-4 h-4" />
              Live Demo
            </Link>
          )}
          {item.githubUrl && (
            <Link
              href={item.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <Github className="w-4 h-4" />
              Source
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Compact version for grid displays
 */
export function PortfolioCardCompact({ item, className }: PortfolioCardProps) {
  return (
    <Link
      href={item.url ?? "#"}
      target={item.url ? "_blank" : undefined}
      rel={item.url ? "noopener noreferrer" : undefined}
      className={cn(
        "group block p-4 rounded-lg border bg-card",
        "hover:border-primary/20 hover:bg-muted/50 transition-colors",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {/* Thumbnail */}
        <div className="relative w-16 h-16 rounded-md bg-muted overflow-hidden flex-shrink-0">
          {item.screenshots[0] ? (
            <Image
              src={item.screenshots[0]}
              alt={item.name}
              fill
              className="object-cover"
              sizes="64px"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-muted-foreground/20">
              {item.name[0]}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="font-medium truncate group-hover:text-primary transition-colors">
            {item.name}
          </h4>
          <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{item.description}</p>
        </div>

        <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </Link>
  );
}
