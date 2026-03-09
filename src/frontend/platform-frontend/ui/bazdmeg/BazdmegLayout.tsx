export const metadata = {
  title: "The BAZDMEG Method | AI-Assisted Quality Gates",
  description: "Eight principles for AI-assisted development. Born from pain. Tested in production. Shift left on AI slop.",
};

export function BazdmegLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground selection:bg-primary/30">
      <main className="flex flex-col relative w-full overflow-hidden">
        {children}
      </main>
    </div>
  );
}
