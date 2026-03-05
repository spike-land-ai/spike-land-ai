import { Link } from "./ui/link";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-card border-t border-border py-12 px-4 sm:px-6 mt-20">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="text-xl font-bold text-foreground">
              spike.land
            </Link>
            <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
              The MCP-first AI development platform. Build, deploy, and manage AI-powered applications at the edge.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-4">Platform</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/tools" className="text-muted-foreground hover:text-foreground transition-colors">App Registry</Link></li>
              <li><Link href="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</Link></li>
              <li><Link href="/apps/new" className="text-muted-foreground hover:text-foreground transition-colors">Build an App</Link></li>
              <li><Link href="/store" className="text-muted-foreground hover:text-foreground transition-colors">App Store</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-4">Resources</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="https://github.com/spike-land-ai/spike-land-ai/tree/main/docs" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">Documentation</a></li>
              <li><Link href="/blog" className="text-muted-foreground hover:text-foreground transition-colors">Blog</Link></li>
              <li><Link href="/about" className="text-muted-foreground hover:text-foreground transition-colors">About Us</Link></li>
              <li><Link href="/bugbook" className="text-muted-foreground hover:text-foreground transition-colors">Bug Tracker</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-4">Legal & Social</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="text-muted-foreground hover:text-foreground transition-colors">Terms of Service</Link></li>
              <li><a href="https://github.com/spike-land-ai" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">GitHub</a></li>
              <li><a href="https://x.com/spikelandai" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">Twitter</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-muted-foreground">
            &copy; {currentYear} spike.land. All rights reserved. Built on Cloudflare Workers.
          </p>
          <div className="flex gap-6">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              All systems operational
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
