"use client";

import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import type { DocsCategory } from "@/lib/docs/types";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  ChevronDown,
  Code2,
  FileText,
  Layout,
  Map,
  Search,
  Terminal,
  Wrench,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface DocsSidebarProps {
  onLinkClick?: (() => void) | undefined;
}

interface NavLinkProps {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  pathname: string;
  onLinkClick?: (() => void) | undefined;
  badge?: React.ReactNode;
}

function NavLink({ href, icon: Icon, label, pathname, onLinkClick, badge }: NavLinkProps) {
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      {...(onLinkClick !== undefined ? { onClick: onLinkClick } : {})}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 relative group",
        isActive
          ? "bg-primary/10 text-primary font-bold shadow-[inset_0_0_0_1px_rgba(var(--primary),0.1)]"
          : "text-muted-foreground hover:text-foreground hover:bg-white/5",
      )}
    >
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full shadow-sm" />
      )}
      <Icon
        className={cn(
          "h-4 w-4 transition-transform group-hover:scale-110",
          isActive ? "text-primary" : "opacity-60 group-hover:opacity-100",
        )}
      />
      <span className="flex-1">{label}</span>
      {badge}
    </Link>
  );
}

interface CategoryGroupProps {
  category: DocsCategory;
  pathname: string;
  onLinkClick?: (() => void) | undefined;
}

function CategoryGroup({ category, pathname, onLinkClick }: CategoryGroupProps) {
  const categoryPath = `/docs/tools/${category.name}`;
  const isActive = pathname === categoryPath;
  const [expanded, setExpanded] = useState(isActive);

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  return (
    <div>
      <button
        type="button"
        onClick={toggleExpanded}
        className={cn(
          "flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 relative group w-full text-left",
          isActive
            ? "bg-primary/10 text-primary font-bold shadow-[inset_0_0_0_1px_rgba(var(--primary),0.1)]"
            : "text-muted-foreground hover:text-foreground hover:bg-white/5",
        )}
      >
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full shadow-sm" />
        )}
        <Terminal
          className={cn(
            "h-3.5 w-3.5 transition-transform group-hover:scale-110",
            isActive ? "text-primary" : "opacity-60 group-hover:opacity-100",
          )}
        />
        <span className="flex-1 capitalize">{category.name.replace(/-/g, " ")}</span>
        <span className="text-[10px] font-semibold bg-white/10 text-muted-foreground px-1.5 py-0.5 rounded-md tabular-nums">
          {category.toolCount}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground/50 transition-transform duration-200",
            expanded && "rotate-180",
          )}
        />
      </button>
      {expanded && (
        <div className="ml-3 mt-0.5 pl-3 border-l border-white/5">
          <Link
            href={categoryPath}
            {...(onLinkClick !== undefined ? { onClick: onLinkClick } : {})}
            className={cn(
              "block px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200",
              isActive
                ? "text-primary bg-primary/5"
                : "text-muted-foreground/70 hover:text-foreground hover:bg-white/5",
            )}
          >
            View all {category.toolCount} tools
          </Link>
        </div>
      )}
    </div>
  );
}

export function DocsSidebar({ onLinkClick }: DocsSidebarProps) {
  const pathname = usePathname();
  const [categories, setCategories] = useState<DocsCategory[]>([]);

  useEffect(() => {
    fetch("/docs-data/tools-manifest.json")
      .then((res) => res.json())
      .then((data: { categories?: DocsCategory[] }) => {
        if (data.categories) {
          setCategories(data.categories);
        }
      })
      .catch(() => {
        // Manifest not available; sidebar will render without tool categories
      });
  }, []);

  const dispatchSearchOpen = useCallback(() => {
    window.dispatchEvent(new CustomEvent("open-command-palette"));
  }, []);

  return (
    <div className="flex flex-col h-full bg-background/40 backdrop-blur-xl">
      {/* Header */}
      <div className="p-4">
        <Link
          href="/docs"
          {...(onLinkClick !== undefined ? { onClick: onLinkClick } : {})}
          className="group"
        >
          <h1 className="text-xl font-bold font-heading text-gradient-primary group-hover:opacity-80 transition-opacity">
            Documentation
          </h1>
          <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-widest font-semibold opacity-70">
            spike.land documentation
          </p>
        </Link>
      </div>

      {/* Search Button */}
      <div className="px-3 mb-2">
        <Button
          variant="outline"
          className="w-full justify-start gap-2 h-9 rounded-lg text-muted-foreground/70 font-normal text-sm"
          onClick={dispatchSearchOpen}
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Search docs...</span>
          <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-white/10 bg-white/5 px-1.5 font-mono text-[10px] font-medium text-muted-foreground/60">
            <span className="text-xs">&#8984;</span>K
          </kbd>
        </Button>
      </div>

      {/* Overview Link */}
      <div className="px-3 mb-2">
        <NavLink
          href="/docs"
          icon={BookOpen}
          label="Overview"
          pathname={pathname}
          onLinkClick={onLinkClick}
        />
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 px-4 pb-8 space-y-6 overflow-y-auto scrollbar-hide relative group/nav">
        <div className="sticky top-0 h-4 bg-gradient-to-b from-background/0 to-transparent z-10 pointer-events-none" />

        {/* Platform */}
        <div className="space-y-0.5">
          <h3 className="px-3 text-[9px] font-bold text-muted-foreground/40 uppercase tracking-[0.2em] mb-1.5">
            Platform
          </h3>
          <div className="space-y-0.5">
            <NavLink
              href="/docs"
              icon={Layout}
              label="Overview"
              pathname={pathname}
              onLinkClick={onLinkClick}
            />
          </div>
        </div>

        {/* MCP Tools */}
        {categories.length > 0 && (
          <div className="space-y-0.5">
            <h3 className="px-3 text-[9px] font-bold text-muted-foreground/40 uppercase tracking-[0.2em] mb-1.5">
              MCP Tools
            </h3>
            <div className="space-y-0.5">
              {categories.map((category) => (
                <CategoryGroup
                  key={category.name}
                  category={category}
                  pathname={pathname}
                  onLinkClick={onLinkClick}
                />
              ))}
            </div>
          </div>
        )}

        {/* API Reference */}
        <div className="space-y-0.5">
          <h3 className="px-3 text-[9px] font-bold text-muted-foreground/40 uppercase tracking-[0.2em] mb-1.5">
            Reference
          </h3>
          <div className="space-y-0.5">
            <NavLink
              href="/docs/api"
              icon={Code2}
              label="API Reference"
              pathname={pathname}
              onLinkClick={onLinkClick}
            />
            <NavLink
              href="/docs/guides"
              icon={FileText}
              label="Guides"
              pathname={pathname}
              onLinkClick={onLinkClick}
            />
            <NavLink
              href="/docs/components"
              icon={Wrench}
              label="Components"
              pathname={pathname}
              onLinkClick={onLinkClick}
            />
            <NavLink
              href="/docs/sitemap"
              icon={Map}
              label="Sitemap"
              pathname={pathname}
              onLinkClick={onLinkClick}
            />
          </div>
        </div>

        {/* Bottom scroll affordance */}
        <div className="sticky bottom-0 h-8 bg-gradient-to-t from-background/20 to-transparent pointer-events-none" />
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/5 bg-black/10">
        <div className="flex items-center gap-3 mb-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
            Version 1.2.0
          </span>
        </div>
        <p className="text-[9px] text-muted-foreground leading-snug opacity-50">
          Built for Spike Land Platform
          <br />
          &copy; 2026 spike.land
        </p>
      </div>
    </div>
  );
}
