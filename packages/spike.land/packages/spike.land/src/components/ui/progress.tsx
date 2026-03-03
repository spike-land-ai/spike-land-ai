"use client";

import * as ProgressPrimitive from "@radix-ui/react-progress";
import * as React from "react";

import { cn } from "@/lib/utils";

import { cva, type VariantProps } from "class-variance-authority";

const indicatorVariants = cva(
  "h-full w-full flex-1 transition-all duration-500 ease-out relative",
  {
    variants: {
      variant: {
        default: "bg-primary",
        success: "bg-success",
        warning: "bg-warning",
        destructive: "bg-destructive",
      },
      glow: {
        true: "",
        false: "",
      },
    },
    compoundVariants: [
      {
        variant: "default",
        glow: true,
        className: "shadow-glow-cyan",
      },
      {
        variant: "success",
        glow: true,
        className: "shadow-glow-success",
      },
      {
        variant: "warning",
        glow: true,
        className: "shadow-glow-warning",
      },
      {
        variant: "destructive",
        glow: true,
        className: "shadow-glow-destructive",
      },
    ],
    defaultVariants: {
      variant: "default",
      glow: false,
    },
  },
);

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  & React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
  & VariantProps<typeof indicatorVariants>
>(({ className, value, variant, glow, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-2 w-full overflow-hidden rounded-full bg-white/10",
      className,
    )}
    aria-valuenow={value ?? 0}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className={cn(indicatorVariants({ variant, glow }))}
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
