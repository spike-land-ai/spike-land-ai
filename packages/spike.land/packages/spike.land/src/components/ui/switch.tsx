"use client";

import * as SwitchPrimitives from "@radix-ui/react-switch";
import * as React from "react";

import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "group peer relative inline-flex h-11 w-20 md:h-7 md:w-14 shrink-0 cursor-pointer items-center rounded-full border border-white/10 bg-black/20 shadow-inner transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-black/40 data-[state=checked]:shadow-glow-green hover:data-[state=unchecked]:bg-black/50",
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "absolute left-1 md:left-0.5 pointer-events-none block h-9 w-9 md:h-6 md:w-6 rounded-full bg-white shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-[38px] md:data-[state=checked]:translate-x-[28px] data-[state=unchecked]:translate-x-0 will-change-transform group-active:scale-95",
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
