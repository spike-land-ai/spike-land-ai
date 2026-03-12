import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

import { cn } from "../../../../lazy-imports/utils";

const alertVariants = cva(
  "relative w-full rounded-2xl border px-5 py-4 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*5)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-4 gap-y-1 items-start [&>svg]:size-5 [&>svg]:translate-y-0.5 [&>svg]:text-current transition-all shadow-sm",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        destructive:
          "text-destructive border-destructive/20 bg-destructive/5 *:data-[slot=alert-description]:text-destructive/80",
        success:
          "text-emerald-400 border-emerald-500/20 bg-emerald-500/5 *:data-[slot=alert-description]:text-emerald-400/80",
        warning:
          "text-amber-400 border-amber-500/20 bg-amber-500/5 *:data-[slot=alert-description]:text-amber-400/80",
        info: "text-blue-400 border-blue-500/20 bg-blue-500/5 *:data-[slot=alert-description]:text-blue-400/80",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const VARIANT_ICONS = {
  default: Info,
  destructive: XCircle,
  success: CheckCircle2,
  warning: AlertTriangle,
  info: Info,
};

function Alert({
  className,
  variant = "default",
  children,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  const Icon = VARIANT_ICONS[variant || "default"];

  // Check if children already contains an SVG icon (lucide-react components are functions, not "svg" strings)
  const hasIcon = React.Children.toArray(children).some(
    (child) => React.isValidElement(child) && typeof child.type === "function",
  );

  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      {!hasIcon && <Icon aria-hidden="true" />}
      {children}
    </div>
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "col-start-2 line-clamp-1 min-h-5 font-bold tracking-tight text-base leading-none",
        className,
      )}
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-muted-foreground col-start-2 grid justify-items-start gap-1 text-sm font-medium [&_p]:leading-relaxed",
        className,
      )}
      {...props}
    />
  );
}

export { Alert, AlertDescription, AlertTitle };
