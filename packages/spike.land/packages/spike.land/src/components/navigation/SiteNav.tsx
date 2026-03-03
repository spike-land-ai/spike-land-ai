"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { useSession } from "@/lib/auth/client/hooks";
import { useAuthDialog } from "@/components/auth/AuthDialogProvider";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { label: "Docs", href: "/docs" },
  { label: "MCP", href: "/mcp" },
  { label: "Apps", href: "/store" },
  { label: "Blog", href: "/blog" },
] as const;

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: session, status } = useSession();
  const { openAuthDialog } = useAuthDialog();
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isAuthenticated = status === "authenticated" && session !== null;
  const isLoading = status === "loading";

  const isStoreOrApp = pathname.startsWith("/store") || pathname.startsWith("/apps");
  if (isStoreOrApp) return null;

  return (
    <>
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 h-16 transition-all duration-300",
          scrolled
            ? "bg-background/90 backdrop-blur-xl border-b border-border/50 shadow-sm"
            : "bg-background/0",
        )}
        role="banner"
      >
        <nav
          className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"
          aria-label="Main navigation"
        >
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 text-foreground hover:opacity-80 transition-opacity"
            aria-label="spike.land home"
          >
            <Zap className="h-5 w-5 text-primary" aria-hidden="true" />
            <span className="font-semibold text-base tracking-tight">
              spike<span className="text-primary">.land</span>
            </span>
          </Link>

          {/* Center nav links — hidden on mobile */}
          <ul className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(({ label, href }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="px-4 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>

          {/* Right side — auth + CTA */}
          <div className="flex items-center gap-2">
            {!isLoading && (
              <>
                {isAuthenticated
                  ? (
                    <Link href="/my-apps">
                      <Button variant="outline" size="sm">
                        Dashboard
                      </Button>
                    </Link>
                  )
                  : (
                    <button
                      onClick={() => openAuthDialog()}
                      className="hidden sm:inline-flex px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
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
              className="md:hidden inline-flex items-center justify-center h-9 w-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
              onClick={() => setMobileOpen(prev => !prev)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav"
            >
              {mobileOpen
                ? <X className="h-5 w-5" aria-hidden="true" />
                : <Menu className="h-5 w-5" aria-hidden="true" />}
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div
          id="mobile-nav"
          className="fixed top-16 left-0 right-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/50 md:hidden"
          role="dialog"
          aria-label="Mobile navigation"
        >
          <ul className="flex flex-col py-3 px-4">
            {NAV_LINKS.map(({ label, href }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                >
                  {label}
                </Link>
              </li>
            ))}
            {!isLoading && !isAuthenticated && (
              <li>
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    openAuthDialog();
                  }}
                  className="w-full text-left block px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                >
                  Sign In
                </button>
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Spacer so content doesn't sit under fixed nav */}
      {pathname !== "/" && <div className="h-16" aria-hidden="true" />}
    </>
  );
}
