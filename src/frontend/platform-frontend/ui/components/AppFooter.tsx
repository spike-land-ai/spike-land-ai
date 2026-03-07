import { Link } from "@tanstack/react-router";
import { Github, Twitter, Mail, ExternalLink, ShieldCheck } from "lucide-react";

export function AppFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className="bg-card/80 backdrop-blur-xl border-t border-border py-16 px-6 mt-32 overflow-hidden relative"
      style={{ contentVisibility: "auto", containIntrinsicSize: "auto 500px" }}
    >
      {/* Decorative background element */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-8">
          <div className="col-span-1 sm:col-span-2 lg:col-span-2 space-y-6 min-h-[160px]">
            <Link to="/" className="text-2xl font-black tracking-tighter text-foreground flex items-center gap-2 group">
              <div className="bg-primary size-8 rounded-lg flex items-center justify-center text-primary-foreground group-hover:rotate-12 transition-transform shadow-lg shadow-primary/20">
                S
              </div>
              spike.land
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
              The world's first MCP-native AI development platform. Build, deploy, and scale high-performance agents and tools at the edge.
            </p>
            <div className="flex items-center gap-4">
              <a
                href="https://github.com/spike-land-ai"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-full bg-muted dark:bg-white/5 border border-border dark:border-white/10 text-muted-foreground hover:text-primary hover:border-primary/30 transition-all"
                aria-label="Visit our GitHub"
              >
                <Github className="size-5" />
              </a>
              <a
                href="https://x.com/ai_spike_land"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-full bg-muted dark:bg-white/5 border border-border dark:border-white/10 text-muted-foreground hover:text-primary hover:border-primary/30 transition-all"
                aria-label="Follow us on Twitter"
              >
                <Twitter className="size-5" />
              </a>
              <a
                href="mailto:hello@spike.land"
                className="p-2 rounded-full bg-muted dark:bg-white/5 border border-border dark:border-white/10 text-muted-foreground hover:text-primary hover:border-primary/30 transition-all"
                aria-label="Email us"
              >
                <Mail className="size-5" />
              </a>
            </div>
          </div>

          <div className="space-y-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Platform</p>
            <ul className="space-y-3 text-sm font-medium">
              <li><Link to="/tools" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2">Tools <span className="text-xs bg-primary/10 px-1 rounded text-primary">New</span></Link></li>
              <li><Link to="/pricing" className="text-muted-foreground hover:text-primary transition-colors">Pricing</Link></li>
              <li><Link to="/store" className="text-muted-foreground hover:text-primary transition-colors">Store</Link></li>
              <li><Link to="/apps" className="text-muted-foreground hover:text-primary transition-colors">Registry</Link></li>
            </ul>
          </div>

          <div className="space-y-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Resources</p>
            <ul className="space-y-3 text-sm font-medium">
              <li><Link to="/docs" className="text-muted-foreground hover:text-primary transition-colors">Documentation</Link></li>
              <li><Link to="/blog" className="text-muted-foreground hover:text-primary transition-colors">Blog</Link></li>
              <li><Link to="/about" className="text-muted-foreground hover:text-primary transition-colors">About Us</Link></li>
              <li><a href="https://status.spike.land" className="text-muted-foreground hover:text-primary transition-colors">System Status</a></li>
            </ul>
          </div>

          <div className="space-y-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Legal</p>
            <ul className="space-y-3 text-sm font-medium">
              <li><Link to="/privacy" className="text-muted-foreground hover:text-primary transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="text-muted-foreground hover:text-primary transition-colors">Terms of Service</Link></li>
              <li><a href="/security" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"><ShieldCheck className="size-3.5" /> Security</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-20 pt-8 border-t border-border dark:border-white/10 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-col items-center md:items-start gap-1">
            <p className="text-xs font-bold text-muted-foreground/60 tracking-tight">
              &copy; {currentYear} spike.land. Built with passion on Cloudflare Workers.
            </p>
            <p className="text-xs text-muted-foreground/40">
              Handcrafted in Europe. Global reach via Edge Computing.
            </p>
          </div>

          <div className="flex items-center gap-6">
            <a
              href="https://github.com/spike-land-ai/spike-land-ai/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-muted-foreground hover:text-primary transition-all flex items-center gap-1.5 bg-muted dark:bg-white/5 border border-border dark:border-white/10 px-3 py-1.5 rounded-full"
            >
              <ExternalLink className="size-3" />
              Changelog
            </a>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/5 border border-success/10">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success/40 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
              </span>
              <span className="text-xs font-bold text-success dark:text-success uppercase tracking-tighter">All Systems Live</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
