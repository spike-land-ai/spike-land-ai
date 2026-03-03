import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold tracking-wide transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-aurora-green to-aurora-teal text-white shadow-lg shadow-aurora-green/20 hover:shadow-aurora-green/40 hover:brightness-110",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-lg shadow-destructive/20",
        success:
          "bg-aurora-green text-white hover:bg-aurora-green/90 shadow-lg shadow-aurora-green/20",
        warning:
          "bg-aurora-yellow text-black hover:bg-aurora-yellow/90 shadow-lg shadow-aurora-yellow/20",
        outline:
          "border border-white/10 bg-white/5 hover:bg-white/10 text-foreground shadow-sm backdrop-blur-sm",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-white/5 hover:text-white",
        link: "text-aurora-teal underline-offset-4 hover:underline",
        gradient:
          "bg-gradient-to-r from-aurora-lime to-aurora-yellow text-black shadow-lg shadow-aurora-lime/20 hover:shadow-aurora-lime/40 hover:brightness-110",
        aurora:
          "bg-gradient-to-r from-aurora-green via-aurora-teal to-aurora-lime text-white shadow-glow-cyan hover:shadow-glow-cyan-sm animate-pulse-slow",
      },
      size: {
        default: "h-11 md:h-10 px-6 md:px-5 py-2",
        sm: "h-10 md:h-9 rounded-lg px-4 text-xs",
        lg: "h-14 md:h-12 rounded-xl px-10 text-base",
        icon: "h-11 w-11 md:h-10 md:w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
