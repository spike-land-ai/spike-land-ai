import { AppHeader } from "@/components/apps/app-header";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blog | spike.land",
  description:
    "Latest news, tutorials, and updates from spike.land. Learn about AI-powered development, MCP tools, and deploying apps with AI.",
};

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* Multi-layered ambient atmosphere */}
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
        {/* Primary violet nebula — top-left */}
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-primary/8 blur-[120px]" />
        {/* Cyan accent nebula — top-right */}
        <div className="absolute -top-20 right-0 w-[500px] h-[400px] rounded-full bg-accent/6 blur-[100px]" />
        {/* Deep violet pool — bottom center */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] rounded-full bg-primary/5 blur-[140px]" />
        {/* Subtle noise texture overlay */}
        <div className="absolute inset-0 bg-noise opacity-40" />
      </div>
      <AppHeader />
      <main className="flex-1 relative z-10">
        {children}
      </main>
    </div>
  );
}
