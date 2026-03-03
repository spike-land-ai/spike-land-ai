"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { useSession } from "@/lib/auth/client/hooks";
import { useAuthDialog } from "@/components/auth/AuthDialogProvider";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { label: "Blog", href: "/blog" },
  { label: "Tools", href: "/mcp" },
  { label: "Pricing", href: "/pricing" },
  { label: "GitHub", href: "https://github.com/spike-land-ai", external: true },
] as const;

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileNavRef = useRef<HTMLDivElement>(null);
  const { data: session, status } = useSession();
  const { openAuthDialog } = useAuthDialog();
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Close mobile menu on Escape key
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const isAuthenticated = status === "authenticated" && session !== null;
  const isLoading = status === "loading";

  const isStoreOrApp = pathname.startsWith("/store") || pathname.startsWith("/apps");
  if (isStoreOrApp) return null;

  return (
    <>
      {/* Skip-to-content for keyboard / screen reader users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-md focus:outline-none focus:ring-2 focus:ring-primary"
      >
        Skip to content
      </a>

      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 h-14 transition-[background-color,border-color] duration-200",
          scrolled
            ? "bg-background border-b border-border"
            : "bg-transparent border-b border-transparent",
        )}
        role="banner"
      >
        <nav
          className="mx-auto flex h-full max-w-6xl items-center justify-between px-4 sm:px-6"
          aria-label="Main navigation"
        >
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-1.5 text-foreground hover:opacity-75 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
            aria-label="spike.land home"
          >
            <Zap className="h-4 w-4 text-primary" aria-hidden="true" />
            <span className="font-semibold text-sm tracking-tight">
              spike<span className="text-primary">.land</span>
            </span>
          </Link>

          {/* Desktop nav links */}
          <ul className="hidden md:flex items-center gap-0.5" role="list">
            {NAV_LINKS.map(({ label, href, ...rest }) => {
              const isExternal = "external" in rest && rest.external;
              const isActive = !isExternal && pathname.startsWith(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    {...(isExternal
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                    className={cn(
                      "inline-block px-3 py-1.5 rounded text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      isActive
                        ? "text-foreground underline underline-offset-4 decoration-primary/60"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Right side — auth + CTA */}
          <div className="flex items-center gap-2">
            {!isLoading && (
              <>
                {isAuthenticated ? (
                  <Link href="/my-apps">
                    <Button variant="outline" size="sm">
                      Dashboard
                    </Button>
                  </Link>
                ) : (
                  <button
                    onClick={() => openAuthDialog()}
                    className="hidden sm:inline-flex px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                    aria-label="Sign in to spike.land"
                  >
                    Sign In
                  </button>
                )}
                <Link href="/my-apps/create">
                  <Button size="sm" variant="default">
                    <Zap className="h-3.5 w-3.5" aria-hidden="true" />
                    Create
                  </Button>
                </Link>
              </>
            )}

            {/* Mobile menu toggle */}
            <button
              className="md:hidden inline-flex items-center justify-center h-8 w-8 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              onClick={() => setMobileOpen((prev) => !prev)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav"
            >
              {mobileOpen ? (
                <X className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Menu className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile slide-in drawer */}
      <div
        id="mobile-nav"
        ref={mobileNavRef}
        role="dialog"
        aria-label="Mobile navigation"
        aria-modal="true"
        aria-hidden={!mobileOpen}
        className={cn(
          "fixed top-14 left-0 right-0 z-40 bg-background border-b border-border md:hidden",
          "transition-[opacity,transform] duration-200 ease-out",
          mobileOpen
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 -translate-y-2 pointer-events-none",
        )}
      >
        <nav aria-label="Mobile menu">
          <ul className="flex flex-col py-2 px-3" role="list">
            {NAV_LINKS.map(({ label, href, ...rest }) => {
              const isExternal = "external" in rest && rest.external;
              const isActive = !isExternal && pathname.startsWith(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    {...(isExternal
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "block px-3 py-2.5 rounded text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      isActive
                        ? "text-foreground bg-muted"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted",
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
            {!isLoading && !isAuthenticated && (
              <li>
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    openAuthDialog();
                  }}
                  className="w-full text-left block px-3 py-2.5 rounded text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Sign In
                </button>
              </li>
            )}
          </ul>
        </nav>
      </div>

      {/* Spacer so content doesn't sit under fixed nav */}
      {pathname !== "/" && <div className="h-14" aria-hidden="true" />}
    </>
  );
}
