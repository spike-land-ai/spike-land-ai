import { Github, Twitter } from "lucide-react";
import Link from "next/link";
import { FooterNewsletter } from "./FooterNewsletter";
import { FooterVisibility } from "./FooterVisibility";

const NAV_COLUMNS = [
  {
    label: "Product",
    links: [
      { href: "/store", label: "App Store" },
      { href: "/mcp", label: "MCP Tools" },
      { href: "/store/skills", label: "Skills" },
      { href: "/pricing", label: "Pricing" },
      { href: "/changelog", label: "Changelog" },
    ],
  },
  {
    label: "Resources",
    links: [
      { href: "/docs", label: "Docs" },
      { href: "/docs/api", label: "API Reference" },
      { href: "https://github.com/spike-land-ai/spike.land", label: "GitHub", external: true },
      { href: "https://www.npmjs.com/org/spike-land", label: "npm Registry", external: true },
      { href: "/status", label: "Status" },
    ],
  },
  {
    label: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/blog", label: "Blog" },
    ],
  },
  {
    label: "Legal",
    links: [
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/terms", label: "Terms of Service" },
    ],
  },
] as const;

export function Footer() {
  return (
    <FooterVisibility>
      <footer className="border-t border-border bg-background pb-safe">
        <div className="container mx-auto px-6 py-12 md:py-16">
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-6">
            {/* Brand + Social + Newsletter */}
            <div className="space-y-5 lg:col-span-2">
              <div>
                <p className="text-base font-semibold tracking-tight text-foreground font-sans">
                  Spike Land
                </p>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  MCP multiplexer with lazy toolset loading. One config, all your servers, zero
                  wasted context.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <a
                  href="https://github.com/spike-land-ai/spike.land"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="GitHub"
                >
                  <Github className="w-4 h-4" />
                </a>
                <a
                  href="https://twitter.com/spikeland"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Twitter / X"
                >
                  <Twitter className="w-4 h-4" />
                </a>
              </div>

              <FooterNewsletter />
            </div>

            {/* Nav columns */}
            {NAV_COLUMNS.map((col) => (
              <div key={col.label} className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {col.label}
                </p>
                <ul className="space-y-2">
                  {col.links.map((link) => (
                    <li key={link.href}>
                      {"external" in link && link.external ? (
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {link.label}
                        </a>
                      ) : (
                        <Link
                          href={link.href}
                          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Bottom bar */}
          <div className="mt-12 border-t border-border pt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} Spike Land Ltd. All rights reserved.
            </p>
            <p className="text-xs text-muted-foreground">
              Built for AI developers.
            </p>
          </div>
        </div>
      </footer>
    </FooterVisibility>
  );
}
