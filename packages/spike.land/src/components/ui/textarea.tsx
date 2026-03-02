import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const textareaVariants = cva(
  "flex min-h-[100px] w-full rounded-xl glass-input px-4 py-3 text-base text-foreground transition-all placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:bg-black/40 disabled:cursor-not-allowed disabled:grayscale disabled:bg-white/5 disabled:opacity-50 md:text-sm",
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

interface TextareaProps
  extends React.ComponentProps<"textarea">,
    VariantProps<typeof textareaVariants> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <textarea className={cn(textareaVariants({ variant, className }))} ref={ref} {...props} />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
