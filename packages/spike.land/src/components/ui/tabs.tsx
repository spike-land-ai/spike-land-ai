"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as React from "react";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => {
  const [indicatorStyle, setIndicatorStyle] = React.useState<React.CSSProperties>({
    left: 0,
    top: 4,
    width: 0,
    height: "calc(100% - 8px)",
    opacity: 0,
  });

  const listRef = React.useRef<HTMLDivElement>(null);
  const isUpdating = React.useRef(false);

  const updateIndicator = React.useCallback(() => {
    if (isUpdating.current || !listRef.current) return;

    isUpdating.current = true;
    requestAnimationFrame(() => {
      const list = listRef.current;
      if (!list) {
        isUpdating.current = false;
        return;
      }

      const activeTrigger = list.querySelector('[data-state="active"]') as HTMLElement;
      if (activeTrigger) {
        setIndicatorStyle((prev) => {
          // Avoid state updates if nothing changed
          if (
            prev.left === activeTrigger.offsetLeft &&
            prev.top === activeTrigger.offsetTop &&
            prev.width === activeTrigger.offsetWidth &&
            prev.height === activeTrigger.offsetHeight &&
            prev.opacity === 1
          ) {
            return prev;
          }
          return {
            left: activeTrigger.offsetLeft,
            top: activeTrigger.offsetTop,
            width: activeTrigger.offsetWidth,
            height: activeTrigger.offsetHeight,
            opacity: 1,
          };
        });
      }
      isUpdating.current = false;
    });
  }, []);

  React.useEffect(() => {
    updateIndicator();
    // Re-calculate on window resize with a small debounce/throttle effect via rAF
    const handleResize = () => updateIndicator();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [updateIndicator]);

  // We need to re-run updateIndicator when the value changes.
  // We can use a MutationObserver to detect when [data-state="active"] moves.
  React.useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const observer = new MutationObserver((mutations) => {
      const hasStateChange = mutations.some(
        (mutation) => mutation.type === "attributes" && mutation.attributeName === "data-state",
      );

      if (hasStateChange) {
        updateIndicator();
      }
    });

    observer.observe(list, {
      attributes: true,
      subtree: true,
      attributeFilter: ["data-state"],
    });

    return () => observer.disconnect();
  }, [updateIndicator]);

  return (
    <TabsPrimitive.List
      ref={(node) => {
        if (typeof ref === "function") ref(node);
        else if (ref) {
          (ref as React.MutableRefObject<typeof node>).current = node;
        }
        (listRef as React.MutableRefObject<typeof node>).current = node;
      }}
      className={cn(
        "relative inline-flex h-16 items-center justify-center rounded-xl bg-muted/30 p-1 text-muted-foreground/60 glass-0",
        className,
      )}
      {...props}
    >
      {/* Animated Background Indicator */}
      <div
        aria-hidden="true"
        className="absolute z-0 rounded-lg bg-primary/15 border border-primary/20 shadow-[0_0_20px_rgba(0,229,255,0.25)] transition-all duration-300 ease-out pointer-events-none glass-edge"
        style={indicatorStyle}
      />
      {props.children}
    </TabsPrimitive.List>
  );
});
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      // Base styles
      "relative z-10 inline-flex items-center justify-center whitespace-nowrap rounded-lg",
      // Sizing - minimum 44px tap target for mobile accessibility
      "min-h-[44px] px-4 py-2.5",
      // Typography
      "text-sm font-medium",
      // Focus states for accessibility
      "ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      // Disabled state
      "disabled:pointer-events-none disabled:opacity-50",
      // Inactive state - improved visibility (70% vs 30%)
      "text-muted-foreground/70",
      // Hover state for inactive tabs
      "hover:text-muted-foreground hover:bg-white/10",
      // Active state - enhanced visibility
      "data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:drop-shadow-[0_0_10px_rgba(0,229,255,0.4)]",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-4 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 animate-in fade-in-50 duration-300",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsContent, TabsList, TabsTrigger };
