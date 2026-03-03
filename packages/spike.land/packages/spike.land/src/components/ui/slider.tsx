"use client";

import * as SliderPrimitive from "@radix-ui/react-slider";
import * as React from "react";

import { cn } from "@/lib/utils";

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex w-full touch-none select-none items-center py-2 md:py-0 group",
      className,
    )}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-3 w-full grow overflow-hidden rounded-full glass-input shadow-inner border border-white/5">
      <SliderPrimitive.Range className="absolute h-full bg-gradient-to-r from-primary to-accent shadow-glow-primary rounded-full opacity-90 transition-all duration-300 ease-out" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block h-7 w-7 md:h-6 md:w-6 rounded-full border border-white/20 bg-background/80 shadow-[0_0_15px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.2)] ring-offset-background transition-transform will-change-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 relative after:content-[''] after:absolute after:inset-1 after:rounded-full after:bg-primary after:shadow-glow-primary-sm group-has-[[data-state=dragging]]:scale-110 group-has-[[data-state=dragging]]:after:bg-accent cursor-grab active:cursor-grabbing backdrop-blur-md" />
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
