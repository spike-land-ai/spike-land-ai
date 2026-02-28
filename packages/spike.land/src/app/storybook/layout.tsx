"use client";

import { storybookIconMap, storybookSections } from "@/components/storybook";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/components/ui/link";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { ArrowUp, Component, Menu, Search, X } from "lucide-react";
import { usePathname } from "next/navigation";
import type React from "react";
import { useEffect, useRef, useState } from "react";

const CHANGELOG = [
  {
    version: "1.2.0",
    date: "2026-02",
    note: "Added Agents, State Machine, Creator, Forms, Infographic pages",
  },
  {
    version: "1.1.0",
    date: "2026-01",
    note: "App Store, Bazdmeg, Canvas sections launched",
  },
  { version: "1.0.0", date: "2025-12", note: "Initial design system release" },
];

const CATEGORY_ACCENT: Record<string, string> = {
  Foundation: "from-cyan-500/40",
  Actions: "from-fuchsia-500/40",
  Elements: "from-violet-500/40",
  Data: "from-blue-500/40",
  Structure: "from-emerald-500/40",
  Status: "from-amber-500/40",
  Overlays: "from-rose-500/40",
  Principles: "from-teal-500/40",
  Features: "from-orange-500/40",
  Systems: "from-red-500/40",
  Content: "from-lime-500/40",
  Apps: "from-sky-500/40",
  Platform: "from-indigo-500/40",
  Marketing: "from-pink-500/40",
};

function VersionTooltip() {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShow(prev => !prev)}
        onBlur={() => setShow(false)}
        className="flex items-center gap-2 group cursor-pointer focus:outline-none"
        aria-label="Show version changelog"
        aria-expanded={show}
        aria-haspopup="true"
      >
        <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground group-hover:text-foreground/70 transition-colors">
          Version 1.2.0
        </span>
      </button>

      {show && (
        <div
          className="absolute bottom-full left-0 mb-2 w-64 rounded-xl border border-white/10 bg-background/95 backdrop-blur-xl shadow-2xl shadow-black/50 z-50 p-3 space-y-2"
          role="tooltip"
        >
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-2">
            Recent Changes
          </p>
          {CHANGELOG.map(entry => (
            <div key={entry.version} className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-primary">
                  {entry.version}
                </span>
                <span className="text-[9px] text-muted-foreground/40">
                  {entry.date}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-snug">
                {entry.note}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BackToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Back to top"
      className={cn(
        "fixed bottom-6 right-6 z-50 flex items-center justify-center w-10 h-10 rounded-full",
        "bg-primary/20 border border-primary/30 text-primary shadow-lg shadow-primary/10",
        "hover:bg-primary/30 hover:scale-110 active:scale-95",
        "transition-all duration-300 backdrop-blur-sm",
        visible
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 translate-y-4 pointer-events-none",
      )}
    >
      <ArrowUp className="h-4 w-4" />
    </button>
  );
}

function SidebarContent({ onLinkClick }: { onLinkClick?: () => void; }) {
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const activeNavRef = useRef<HTMLAnchorElement>(null);
  const navRef = useRef<HTMLElement>(null);

  // Persist sidebar scroll position across route changes
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const key = "storybook-sidebar-scroll";
    const saved = sessionStorage.getItem(key);
    if (saved !== null) nav.scrollTop = parseInt(saved, 10);
    const handleScroll = () => sessionStorage.setItem(key, String(nav.scrollTop));
    nav.addEventListener("scroll", handleScroll, { passive: true });
    return () => nav.removeEventListener("scroll", handleScroll);
  }, []);

  // Keyboard shortcut: "/" focuses search when not in an input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName.toLowerCase();
      if (e.key === "/" && tag !== "input" && tag !== "textarea") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Scroll active item into view only if no saved scroll position
  useEffect(() => {
    const saved = sessionStorage.getItem("storybook-sidebar-scroll");
    if (!saved) {
      activeNavRef.current?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, []);

  const groupedSections = storybookSections.reduce((acc, section) => {
    const category = section.category || "General";
    if (!acc[category]) acc[category] = [];
    acc[category].push(section);
    return acc;
  }, {} as Record<string, (typeof storybookSections)[number][]>);

  type SectionItem = (typeof storybookSections)[number];

  const lowerSearch = search.toLowerCase();
  const filteredGrouped: Record<string, SectionItem[]> = search
    ? Object.fromEntries(
      Object.entries(groupedSections)
        .map(([cat, sections]): [string, SectionItem[]] => [
          cat,
          sections.filter(
            s =>
              s.label.toLowerCase().includes(lowerSearch)
              || (s.description?.toLowerCase().includes(lowerSearch) ?? false),
          ),
        ])
        .filter(([, sections]) => sections.length > 0),
    )
    : groupedSections;

  const categories = Object.keys(filteredGrouped);
  const hasResults = categories.length > 0;

  return (
    <div className="flex flex-col h-full bg-background/40 backdrop-blur-xl">
      <div className="p-4">
        <Link href="/storybook" {...(onLinkClick !== undefined ? { onClick: onLinkClick } : {})} className="group">
          <h1 className="text-xl font-bold font-heading text-gradient-primary group-hover:opacity-80 transition-opacity">
            Design System
          </h1>
          <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-widest font-semibold opacity-70">
            spike.land design system
          </p>
        </Link>
      </div>

      {/* Search input with "/" keyboard shortcut badge */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50 pointer-events-none" />
          <Input
            ref={searchRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search components..."
            aria-label="Search components"
            className="h-8 text-xs pl-7 pr-14 bg-white/5 border-white/10 rounded-lg placeholder:text-muted-foreground/40 focus-visible:ring-primary/30"
          />
          {!search && (
            <kbd
              aria-hidden="true"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none inline-flex items-center rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-[9px] font-mono font-semibold text-muted-foreground/50 leading-none select-none"
            >
              /
            </kbd>
          )}
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      <div className="px-3 mb-2">
        <Link
          href="/storybook"
          {...(onLinkClick !== undefined ? { onClick: onLinkClick } : {})}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 relative group",
            pathname === "/storybook"
              ? "bg-primary/10 text-primary shadow-[inset_0_0_0_1px_rgba(var(--primary),0.1)]"
              : "text-muted-foreground hover:text-foreground hover:bg-white/10",
          )}
        >
          {pathname === "/storybook" && (
            <div className="absolute left-0 w-1 h-4 bg-primary rounded-r-full" />
          )}
          <Component
            className={cn(
              "h-4 w-4",
              pathname === "/storybook"
                ? "text-primary"
                : "opacity-70 group-hover:opacity-100",
            )}
          />
          Overview
        </Link>
      </div>

      <nav
        ref={navRef}
        className="flex-1 px-4 pb-8 overflow-y-auto scrollbar-hide relative group/nav"
        aria-label="Component navigation"
      >
        {/* Scroll affordance gradient */}
        <div className="sticky top-0 h-4 bg-gradient-to-b from-background/0 to-transparent z-10 pointer-events-none" />

        <div className="space-y-1">
          {hasResults
            ? categories.map((category, catIndex) => {
              const items = filteredGrouped[category] ?? [];
              const accentFrom = CATEGORY_ACCENT[category] ?? "from-white/20";

              return (
                <div key={category}>
                  {catIndex > 0 && (
                    <div
                      className={cn(
                        "h-px my-3 bg-gradient-to-r to-transparent opacity-30",
                        accentFrom,
                      )}
                      role="separator"
                      aria-hidden="true"
                    />
                  )}
                  <div className="space-y-0.5">
                    <h3 className="px-3 text-[9px] font-bold text-muted-foreground/40 uppercase tracking-[0.2em] mb-1.5 mt-1">
                      {category}
                      <span className="text-[8px] opacity-30 ml-1">
                        ({items.length})
                      </span>
                    </h3>
                    <div className="space-y-0.5">
                      {items.map(section => {
                        const Icon = storybookIconMap[
                          section.icon as keyof typeof storybookIconMap
                        ];
                        const isActive = pathname === `/storybook/${section.id}`;

                        return (
                          <Link
                            key={section.id}
                            href={`/storybook/${section.id}`}
                            {...(onLinkClick !== undefined ? { onClick: onLinkClick } : {})}
                            ref={isActive ? activeNavRef : undefined}
                            aria-current={isActive ? "page" : undefined}
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
                            {Icon && (
                              <Icon
                                className={cn(
                                  "h-4 w-4 transition-transform group-hover:scale-110",
                                  isActive
                                    ? "text-primary"
                                    : "opacity-60 group-hover:opacity-100",
                                )}
                              />
                            )}
                            {section.label}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })
            : (
              <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                <Search className="h-6 w-6 text-muted-foreground/20" />
                <p className="text-xs text-muted-foreground/40">
                  No components match
                </p>
              </div>
            )}
        </div>

        {/* Bottom scroll affordance */}
        <div className="sticky bottom-0 h-8 bg-gradient-to-t from-background/20 to-transparent pointer-events-none" />
      </nav>

      <div className="p-4 border-t border-white/5 bg-black/10">
        <div className="flex items-center gap-3 mb-1.5">
          <VersionTooltip />
        </div>
        <p className="text-[9px] text-muted-foreground leading-snug opacity-50">
          Built for Spike Land Platform<br />
          © 2026 spike.land
        </p>
      </div>
    </div>
  );
}

export default function StorybookLayout(
  { children }: { children: React.ReactNode; },
) {
  const [open, setOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-[#040408] selection:bg-primary/30">
      {/* Mobile Header — safe-area-inset padding for notched devices */}
      <div
        className="lg:hidden sticky top-0 z-50 border-b border-white/5 bg-background/80 backdrop-blur-md"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div
          className="flex items-center justify-between h-14"
          style={{
            paddingLeft: "max(1rem, env(safe-area-inset-left, 0px))",
            paddingRight: "max(1rem, env(safe-area-inset-right, 0px))",
          }}
        >
          <Link href="/storybook">
            <span className="font-bold font-heading">Design System</span>
          </Link>
          {isMounted
            ? (
              <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Open navigation menu"
                  >
                    <span
                      className={cn(
                        "transition-all duration-200",
                        open
                          ? "rotate-90 opacity-0 scale-75 absolute"
                          : "rotate-0 opacity-100",
                      )}
                      aria-hidden="true"
                    >
                      <Menu className="h-5 w-5" />
                    </span>
                    <span
                      className={cn(
                        "transition-all duration-200",
                        open
                          ? "rotate-0 opacity-100"
                          : "-rotate-90 opacity-0 scale-75 absolute",
                      )}
                      aria-hidden="true"
                    >
                      <X className="h-5 w-5" />
                    </span>
                    <span className="sr-only">Toggle menu</span>
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="left"
                  className="w-72 p-0 transition-transform duration-300 ease-in-out"
                >
                  <SheetTitle className="sr-only">
                    Design System Navigation
                  </SheetTitle>
                  <SidebarContent onLinkClick={() => setOpen(false)} />
                </SheetContent>
              </Sheet>
            )
            : (
              <Button variant="ghost" size="icon" aria-label="Toggle menu">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            )}
        </div>
      </div>

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 border-r border-border bg-background/50 backdrop-blur-sm">
          <SidebarContent />
        </aside>

        {/* Main Content */}
        <main className="flex-1 lg:pl-64">
          <div className="container mx-auto py-8 px-6 max-w-7xl">
            {children}
          </div>
        </main>
      </div>

      {/* Back to top button */}
      <BackToTopButton />
    </div>
  );
}
