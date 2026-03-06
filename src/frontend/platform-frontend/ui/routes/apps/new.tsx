import { useState } from "react";
import { Link } from "@tanstack/react-router";

export function AppsNewPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/apps" className="text-primary hover:underline">
          Apps
        </Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-2xl font-bold text-foreground">Create App</h1>
      </div>

      <div className="rounded-2xl border border-border bg-card dark:glass-card p-8 text-center space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <span className="text-2xl" role="img" aria-label="Rocket">🚀</span>
        </div>
        
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground">App Creation is Coming Soon</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            We're building a seamless experience for deploying AI apps directly to the edge.
            Join the waitlist to get early access.
          </p>
        </div>

        {submitted ? (
          <div className="rounded-lg bg-success/10 p-4 text-success-foreground border border-success/20">
            Thanks! We'll notify you when app creation is ready.
          </div>
        ) : (
          <form 
            onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }}
            className="flex flex-col sm:flex-row gap-3 max-w-sm mx-auto"
          >
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Join Waitlist
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
