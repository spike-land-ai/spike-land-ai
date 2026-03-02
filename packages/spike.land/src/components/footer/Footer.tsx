import { Github, Linkedin, Twitter } from "lucide-react";
import Link from "next/link";
import { FooterNewsletter } from "./FooterNewsletter";
import { FooterVisibility } from "./FooterVisibility";

export function Footer() {
  return (
    <FooterVisibility>
      <footer className="border-t border-white/10 bg-black/20 backdrop-blur-lg pb-safe">
        <div className="container mx-auto px-4 py-12 md:py-16 lg:py-20">
          <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-6">
            {/* Brand */}
            <div className="space-y-4 lg:col-span-2">
              <h3 className="text-xl font-bold tracking-tight font-heading bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                Spike Land
              </h3>
              <p className="text-sm text-muted-foreground">
                MCP multiplexer with lazy toolset loading. One config, all your servers, zero wasted
                context.
              </p>

              <div className="flex items-center gap-3">
                <a
                  href="https://github.com/spike-land-ai/spike.land"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors"
                  aria-label="GitHub"
                >
                  <Github className="w-5 h-5" />
                </a>
                <a
                  href="https://twitter.com/spikeland"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors"
                  aria-label="Twitter / X"
                >
                  <Twitter className="w-5 h-5" />
                </a>
                <a
                  href="https://linkedin.com/company/spike-land"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors"
                  aria-label="LinkedIn"
                >
                  <Linkedin className="w-5 h-5" />
                </a>
              </div>

              <FooterNewsletter />
            </div>

            {/* Developers */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-white font-heading">Developers</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/docs" className="hover:text-primary transition-colors">
                    Docs
                  </Link>
                </li>
                <li>
                  <Link href="/mcp" className="hover:text-primary transition-colors">
                    MCP Tools
                  </Link>
                </li>
                <li>
                  <Link href="/store" className="hover:text-primary transition-colors">
                    App Store
                  </Link>
                </li>
                <li>
                  <Link href="/store/skills" className="hover:text-primary transition-colors">
                    Skills
                  </Link>
                </li>
                <li>
                  <Link href="/docs/api" className="hover:text-primary transition-colors">
                    API Reference
                  </Link>
                </li>
              </ul>
            </div>

            {/* Company */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-white font-heading">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/blog" className="hover:text-primary transition-colors">
                    Blog
                  </Link>
                </li>
                <li>
                  <Link href="/about" className="hover:text-primary transition-colors">
                    About
                  </Link>
                </li>
                <li>
                  <Link href="/pricing" className="hover:text-primary transition-colors">
                    Pricing
                  </Link>
                </li>
                <li>
                  <a
                    href="https://github.com/spike-land-ai/spike.land"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-primary transition-colors"
                  >
                    GitHub
                  </a>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-white font-heading">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/privacy" className="hover:text-primary transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:text-primary transition-colors">
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>

            {/* Resources */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-white font-heading">Resources</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a
                    href="https://github.com/spike-land-ai/spike.land"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-primary transition-colors"
                  >
                    GitHub ↗
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.npmjs.com/org/spike-land"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-primary transition-colors"
                  >
                    npm Registry ↗
                  </a>
                </li>
                <li>
                  <Link href="/changelog" className="hover:text-primary transition-colors">
                    Changelog
                  </Link>
                </li>
                <li>
                  <Link href="/status" className="hover:text-primary transition-colors">
                    Status Page
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 border-t border-white/10 pt-8 text-sm text-muted-foreground flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <p>&copy; {new Date().getFullYear()} Spike Land. All rights reserved.</p>
            <span className="flex items-center gap-1.5 text-xs text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              All systems operational
            </span>
          </div>
        </div>
      </footer>
    </FooterVisibility>
  );
}
