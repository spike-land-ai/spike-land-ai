import { cn } from "@/lib/utils";

interface ProseProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

/**
 * Typography wrapper component for blog content
 * Provides consistent styling for long-form content
 */
export function Prose({ children, className, ...props }: ProseProps) {
  return (
    <div
      className={cn(
        "prose-blog",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
