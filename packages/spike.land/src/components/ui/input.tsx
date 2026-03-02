import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const inputVariants = cva(
  "flex h-12 w-full rounded-xl glass-input px-4 py-2 text-base text-foreground transition-all file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:bg-black/40 disabled:cursor-not-allowed disabled:grayscale disabled:bg-white/10 disabled:opacity-60 md:text-sm",
  {
    variants: {
      variant: {
        default: "",
        error:
          "ring-2 ring-destructive/30 bg-destructive/5 placeholder:text-destructive/40 focus-visible:ring-destructive",
        success:
          "ring-2 ring-success/30 bg-success/5 placeholder:text-success/40 focus-visible:ring-success",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement>,
    VariantProps<typeof inputVariants> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(inputVariants({ variant, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
