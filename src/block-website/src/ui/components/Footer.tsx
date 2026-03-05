import { Link } from "./ui/link";
import { Github, Twitter, Mail, ExternalLink, ShieldCheck, Globe, Cpu, Zap } from "lucide-react";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-card border-t border-border py-20 px-6 mt-32 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-8">
          <div className="col-span-1 sm:col-span-2 lg:col-span-2 space-y-8">
            <Link href="/" className="text-3xl font-black tracking-tighter text-foreground flex items-center gap-3 group">
              <div className="bg-primary size-10 rounded-2xl flex items-center justify-center text-primary-foreground group-hover:rotate-12 transition-transform shadow-xl shadow-primary/20">
                S
              </div>
              spike.land
            </Link>
            <p className="text-base text-muted-foreground leading-relaxed max-w-sm font-medium">
              The foundational layer for the agentic web. Build and scale high-performance MCP tools at the edge.
            </p>
            <div className="flex items-center gap-4">
              <a
                href="https://github.com/spike-land-ai"
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 rounded-2xl bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all shadow-sm"
                aria-label="GitHub"
              >
                <Github className="size-5" />
              </a>
              <a
                href="https://x.com/ai_spike_land"
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 rounded-2xl bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all shadow-sm"
                aria-label="Twitter"
              >
                <Twitter className="size-5" />
              </a>
              <a
                href="mailto:hello@spike.land"
                className="p-3 rounded-2xl bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all shadow-sm"
                aria-label="Email"
              >
                <Mail className="size-5" />
              </a>
            </div>
          </div>

          <div className="space-y-6">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40">Platform</p>
            <ul className="space-y-4 text-sm font-bold text-muted-foreground">
              <li><Link href="/tools" className="hover:text-primary transition-colors flex items-center gap-2">Tools <Zap size={12} className="text-primary fill-primary" /></Link></li>
              <li><Link href="/pricing" className="hover:text-primary transition-colors">Pricing</Link></li>
              <li><Link href="/apps/new" className="hover:text-primary transition-colors">Create Tool</Link></li>
              <li><Link href="/store" className="hover:text-primary transition-colors">Store</Link></li>
            </ul>
          </div>

          <div className="space-y-6">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40">Developer</p>
            <ul className="space-y-4 text-sm font-bold text-muted-foreground">
              <li><Link href="/docs" className="hover:text-primary transition-colors">Documentation</Link></li>
              <li><Link href="/blog" className="hover:text-primary transition-colors">Engineering Blog</Link></li>
              <li><Link href="/about" className="hover:text-primary transition-colors">Our Mission</Link></li>
              <li><Link href="/bugbook" className="hover:text-primary transition-colors">Bug Tracker</Link></li>
            </ul>
          </div>

          <div className="space-y-6">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40">Legal</p>
            <ul className="space-y-4 text-sm font-bold text-muted-foreground">
              <li><Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link></li>
              <li><Link href="/security" className="hover:text-primary transition-colors flex items-center gap-1.5"><ShieldCheck className="size-3.5" /> Security</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-24 pt-8 border-t border-border/50 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col items-center md:items-start gap-1">
            <p className="text-[11px] font-black text-muted-foreground/60 uppercase tracking-widest">
              &copy; {currentYear} spike.land &middot; Global Edge Network
            </p>
            <div className="flex items-center gap-4 mt-2">
              <span className="text-[10px] font-bold text-muted-foreground/40 flex items-center gap-1"><Globe size={10} /> Cloudflare D1</span>
              <span className="text-[10px] font-bold text-muted-foreground/40 flex items-center gap-1"><Cpu size={10} /> V8 Isolates</span>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Operational</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
