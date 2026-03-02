import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const cardVariants = cva("rounded-2xl transition-all duration-300", {
  variants: {
    variant: {
      default:
        "glass-1 glass-edge text-card-foreground shadow-lg active:scale-[0.99] active:duration-150",
      solid:
        "bg-secondary text-secondary-foreground border border-white/10 shadow-sm active:scale-[0.99]",
      highlighted:
        "glass-1 glass-edge text-card-foreground shadow-glow-cyan backdrop-blur-[14px] ring-1 ring-primary/30 active:scale-[1.0]",
      dashed:
        "border-2 border-dashed border-white/10 bg-white/[0.02] text-muted-foreground shadow-none opacity-60 transition-all active:scale-[0.98]",
      ghost: "border-none shadow-none bg-transparent transition-colors active:bg-white/5",
      negative: "shadow-negative bg-neutral-800 text-neutral-200 border-none",
      floating: "shadow-floating bg-card glass-edge text-card-foreground",
      magic:
        "shadow-magic bg-card/80 border-t border-white/10 glass-edge-sm text-card-foreground backdrop-blur-3xl",
      blue: "glass-aura-blue border-none text-white",
      green: "glass-aura-green border-none text-white",
      orange: "glass-aura-orange border-none text-white",
      fuchsia: "glass-aura-fuchsia border-none text-white",
      purple: "glass-aura-purple border-none text-white",
      pink: "glass-aura-pink border-none text-white",
      layers: "glass-layers border-none text-white",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, ...props }, ref) => (
    <div ref={ref} className={cn("Card", cardVariants({ variant, className }))} {...props} />
  ),
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-2 p-8", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "font-bold font-heading leading-tight tracking-tight text-foreground",
        className,
      )}
      {...props}
    />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-8 pt-0", className)} {...props} />
  ),
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-8 pt-0", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
