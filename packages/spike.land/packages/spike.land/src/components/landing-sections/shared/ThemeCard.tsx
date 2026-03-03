import { cn } from "@/lib/utils";

interface ThemeCardProps {
  children: React.ReactNode;
  className?: string;
  hoverEffect?: boolean;
  glass?: boolean;
}

export function ThemeCard(
  { children, className, hoverEffect = false, glass = false }: ThemeCardProps,
) {
  return (
    <div
      className={cn(
        "relative overflow-hidden p-6 rounded-[var(--landing-radius)]",
        "border border-[var(--landing-border)] bg-[var(--landing-secondary)]/50",
        {
          "backdrop-blur-md bg-[var(--landing-background)]/70": glass,
          "transition-all duration-300 hover:border-[var(--landing-primary)] hover:translate-y-[-2px] hover:shadow-lg":
            hoverEffect,
        },
        className,
      )}
    >
      {children}
    </div>
  );
}
