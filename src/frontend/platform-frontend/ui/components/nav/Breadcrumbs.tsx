/**
 * Breadcrumbs component
 *
 * Auto-generated from the current TanStack Router location. Each path segment
 * becomes a clickable breadcrumb. The final segment is rendered as plain text
 * (not a link) to indicate the current page.
 *
 * Usage:
 *   import { Breadcrumbs } from "../components/nav/Breadcrumbs";
 *   // In any content page (not the landing page):
 *   <Breadcrumbs />
 *
 * Custom labels:
 *   <Breadcrumbs labels={{ "/apps": "App Store", "/learnit": "Learn" }} />
 */

import { Link, useRouterState } from "@tanstack/react-router";

interface BreadcrumbsProps {
  /** Override display labels for specific path prefixes. Key is the full path segment string. */
  labels?: Record<string, string>;
  /** Additional CSS classes for the wrapping <nav> */
  className?: string;
}

const SEGMENT_LABELS: Record<string, string> = {
  apps: "App Store",
  "vibe-code": "Vibe Code",
  learnit: "LearnIt",
  blog: "Blog",
  docs: "Docs",
  learn: "Learn",
  bugbook: "Bug Book",
  analytics: "Analytics",
  dashboard: "Dashboard",
  settings: "Settings",
  pricing: "Pricing",
  migrate: "Migrate",
  create: "Create",
  chess: "Chess",
  quiz: "Quiz",
  "thank-you": "Thank You",
  store: "Store",
  category: "Category",
  mcp: "MCP",
  tools: "Tools",
  tool: "Tool",
  packages: "Packages",
  messages: "Messages",
  status: "Status",
  "vibe-code/": "Vibe Code",
};

function formatSegment(segment: string): string {
  return (
    SEGMENT_LABELS[segment] ??
    segment
      .replace(/-/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase())
  );
}

export function Breadcrumbs({ labels = {}, className = "" }: BreadcrumbsProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Don't render on home page
  if (pathname === "/") return null;

  const segments = pathname.split("/").filter(Boolean);

  // Build items: each item has a href and display label
  const items = [
    { href: "/", label: "Home" },
    ...segments.map((seg, i) => {
      const href = `/${segments.slice(0, i + 1).join("/")}`;
      const displayLabel = labels[href] ?? formatSegment(seg);
      return { href, label: displayLabel };
    }),
  ];

  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground ${className}`}
    >
      <ol className="flex flex-wrap items-center gap-1.5 list-none p-0 m-0">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={item.href} className="flex items-center gap-1.5">
              {index > 0 && (
                <svg
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              )}
              {isLast ? (
                <span
                  className="font-medium text-foreground truncate max-w-[200px]"
                  aria-current="page"
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  to={item.href as "/"}
                  className="hover:text-foreground transition-colors truncate max-w-[160px]"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
