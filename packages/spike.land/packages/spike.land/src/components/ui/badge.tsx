import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "glass-1 glass-edge rounded-full border-white/5 text-foreground/90 shadow-sm hover:glass-2 transition-all duration-300",
        secondary: "bg-aurora-teal/10 text-aurora-teal border border-aurora-teal/20 rounded-full",
        destructive: "bg-destructive/10 text-destructive border border-destructive/20 rounded-full",
        success: "bg-aurora-green/10 text-aurora-green border border-aurora-green/20 rounded-full",
        warning:
          "bg-aurora-yellow/10 text-aurora-yellow border border-aurora-yellow/20 rounded-full",
        outline: "text-foreground/80 border border-white/10 rounded-full hover:bg-white/5",
        overlay:
          "bg-black/60 text-white hover:bg-black/70 border-none backdrop-blur-[2px] rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div
      className={cn("Badge", badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge };
